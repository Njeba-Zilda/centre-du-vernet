package cm.duala.vernet.user.api;

import cm.duala.vernet.audit.ActivityService;
import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.messaging.MessageRepository;
import cm.duala.vernet.messaging.MessageThreadRepository;
import cm.duala.vernet.notifications.NotificationRepository;
import cm.duala.vernet.planning.AppointmentRepository;
import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import cm.duala.vernet.user.UserRole;
import cm.duala.vernet.weight.WeightEntryRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AppUserRepository       users;
    private final MessageRepository       messages;
    private final MessageThreadRepository threads;
    private final WeightEntryRepository   weights;
    private final AppointmentRepository   appts;
    private final NotificationRepository  notifs;
    private final ActivityService         activity;

    public UserController(AppUserRepository users, MessageRepository messages,
        MessageThreadRepository threads, WeightEntryRepository weights,
        AppointmentRepository appts, NotificationRepository notifs, ActivityService activity) {
        this.users    = users;
        this.messages = messages;
        this.threads  = threads;
        this.weights  = weights;
        this.appts    = appts;
        this.notifs   = notifs;
        this.activity = activity;
    }

    // ── Liste des clients avec recherche optionnelle ──
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST')")
    @GetMapping("/clients")
    public List<UserDto> listClients(@RequestParam(required = false) String q) {
        if (q != null && !q.isBlank()) {
            return users.searchClients(UserRole.CLIENT, q.trim()).stream().map(UserDto::from).toList();
        }
        return users.findByRoleInOrderByEmailAsc(List.of(UserRole.CLIENT))
            .stream().map(UserDto::from).toList();
    }

    // ── Dossier complet d'un client ──
    @GetMapping("/{id}/dossier")
    public ResponseEntity<?> getDossier(@PathVariable Long id) {
        AppUser me = SecurityUtil.requireUser();
        // Un client ne peut voir que son propre dossier
        if (me.getRole() == UserRole.CLIENT && !me.getId().equals(id)) {
            return ResponseEntity.status(403).build();
        }

        AppUser client = users.findById(id).orElse(null);
        if (client == null) return ResponseEntity.notFound().build();

        // Mesures de poids
        var weightList = weights.findByClientOrderByDateAsc(client).stream().map(e -> {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("id",       e.getId());
            d.put("date",     e.getDate().toString());
            d.put("weightKg", e.getWeightKg());
            d.put("heightCm", e.getHeightCm());
            if (e.getHeightCm() != null && e.getHeightCm() > 0) {
                double h = e.getHeightCm() / 100.0;
                d.put("bmi", Math.round((e.getWeightKg() / (h * h)) * 10.0) / 10.0);
            } else { d.put("bmi", null); }
            d.put("notes",    e.getNotes());
            return d;
        }).toList();

        // Rendez-vous
        var apptList = appts.findByClientOrderByScheduledAtAsc(client).stream().map(a -> {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("id",          a.getId());
            d.put("scheduledAt", a.getScheduledAt().toString());
            d.put("type",        a.getType());
            d.put("status",      a.getStatus());
            d.put("notes",       a.getNotes());
            d.put("staffEmail",  a.getStaff() != null ? a.getStaff().getEmail() : null);
            d.put("staffName",   a.getStaff() != null
                ? (a.getStaff().getFirstName() != null ? a.getStaff().getFirstName() + " " + a.getStaff().getLastName() : a.getStaff().getEmail())
                : null);
            return d;
        }).toList();

        long threadCount = threads.countByClient(client);

        return ResponseEntity.ok(Map.of(
            "user",          UserDto.from(client),
            "weightEntries", weightList,
            "appointments",  apptList,
            "threadCount",   threadCount
        ));
    }

    // ── Liste de tous les utilisateurs (admin seulement) ──
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @GetMapping
    public List<UserDto> listAll() {
        return users.findAll().stream()
            .sorted(java.util.Comparator.comparing(AppUser::getEmail))
            .map(UserDto::from).toList();
    }

    // ── Activer / désactiver un compte ──
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PutMapping("/{id}/enabled")
    public ResponseEntity<?> setEnabled(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        AppUser me = SecurityUtil.requireUser();
        if (me.getId().equals(id))
            return ResponseEntity.badRequest().body(Map.of("error", "CANNOT_MODIFY_SELF"));
        AppUser u = users.findById(id).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        u.setEnabled(body.getOrDefault("enabled", true));
        return ResponseEntity.ok(UserDto.from(users.save(u)));
    }

    // ── Changer le rôle d'un utilisateur ──
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PutMapping("/{id}/role")
    public ResponseEntity<?> setRole(@PathVariable Long id, @RequestBody Map<String, String> body) {
        AppUser me = SecurityUtil.requireUser();
        if (me.getId().equals(id))
            return ResponseEntity.badRequest().body(Map.of("error", "CANNOT_MODIFY_SELF"));
        AppUser u = users.findById(id).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        try {
            u.setRole(UserRole.valueOf(body.get("role")));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_ROLE"));
        }
        return ResponseEntity.ok(UserDto.from(users.save(u)));
    }

    // ── Supprimer un utilisateur et toutes ses données ──
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        AppUser me = SecurityUtil.requireUser();
        if (me.getId().equals(id))
            return ResponseEntity.badRequest().body(Map.of("error", "CANNOT_DELETE_SELF"));

        AppUser u = users.findById(id).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();

        // 1. Notifications
        notifs.deleteByUser(u);
        // 2. Mesures de poids
        weights.deleteByClient(u);
        // 3. Rendez-vous : nullifier le staff, supprimer ceux où il est client
        appts.clearStaffRef(u);
        appts.deleteByClient(u);
        // 4. Messagerie : nullifier les refs coach/nutritionniste, supprimer ses fils de client
        threads.clearCoachRef(u);
        threads.clearNutritionistRef(u);
        threads.findByClient(u).forEach(t -> {
            messages.deleteByThread(t);
            threads.deleteById(t.getId());
        });
        // 5. Supprimer l'utilisateur
        String deletedEmail = u.getEmail();
        users.deleteById(id);
        activity.log("USER_DELETED", me.getEmail(), deletedEmail, "Compte supprimé");

        return ResponseEntity.ok(Map.of("deleted", true));
    }

    // ── Statistiques globales (staff + admin) ──
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST')")
    @GetMapping("/stats")
    public Map<String, Object> stats() {
        long totalClients = users.findByRoleInOrderByEmailAsc(List.of(UserRole.CLIENT)).size();
        long totalStaff   = users.findByRoleInOrderByEmailAsc(List.of(
            UserRole.SUPER_ADMIN, UserRole.SECRETARY, UserRole.COACH, UserRole.NUTRITIONIST)).size();
        return Map.of(
            "totalClients",       totalClients,
            "totalStaff",         totalStaff,
            "totalMessages",      messages.count(),
            "totalThreads",       threads.count(),
            "totalWeightEntries", weights.count(),
            "totalAppointments",  appts.count()
        );
    }

    static class UserDto {
        public Long    id;
        public String  email;
        public String  firstName;
        public String  lastName;
        public String  gender;
        public String  role;
        public boolean enabled;
        public String  createdAt;

        static UserDto from(AppUser u) {
            var d = new UserDto();
            d.id        = u.getId();
            d.email     = u.getEmail();
            d.firstName = u.getFirstName();
            d.lastName  = u.getLastName();
            d.gender    = u.getGender();
            d.role      = u.getRole().name();
            d.enabled   = u.isEnabled();
            d.createdAt = u.getCreatedAt() == null ? null : u.getCreatedAt().toString();
            return d;
        }
    }
}
