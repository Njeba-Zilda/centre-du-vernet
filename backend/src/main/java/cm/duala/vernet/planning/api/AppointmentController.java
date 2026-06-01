package cm.duala.vernet.planning.api;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.notifications.NotificationService;
import cm.duala.vernet.planning.Appointment;
import cm.duala.vernet.planning.AppointmentRepository;
import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import cm.duala.vernet.user.UserRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final AppointmentRepository appts;
    private final AppUserRepository     users;
    private final NotificationService   notifications;

    public AppointmentController(AppointmentRepository appts, AppUserRepository users,
                                 NotificationService notifications) {
        this.appts         = appts;
        this.users         = users;
        this.notifications = notifications;
    }

    @PreAuthorize("hasAnyRole('CLIENT','COACH','NUTRITIONIST','SECRETARY','ADMIN','SUPER_ADMIN')")
    @GetMapping
    public List<ApptDto> list() {
        AppUser u = SecurityUtil.requireUser();
        if (u.getRole() == UserRole.CLIENT) {
            return appts.findByClientOrderByScheduledAtAsc(u).stream().map(ApptDto::from).toList();
        } else if (u.getRole() == UserRole.SUPER_ADMIN) {
            // Super Admin voit tout
            return appts.findAllByOrderByScheduledAtAsc().stream().map(ApptDto::from).toList();
        } else {
            // Autres employés : uniquement les RDV qui leur sont assignés
            return appts.findByStaffOrderByScheduledAtAsc(u).stream().map(ApptDto::from).toList();
        }
    }

    @PreAuthorize("hasAnyRole('CLIENT','COACH','NUTRITIONIST','SECRETARY','ADMIN','SUPER_ADMIN')")
    @PostMapping
    public ResponseEntity<?> create(@RequestBody @Valid CreateApptRequest req) {
        AppUser sender = SecurityUtil.requireUser();
        Long clientId = (sender.getRole() == UserRole.CLIENT) ? sender.getId() : req.clientId();
        if (clientId == null)
            return ResponseEntity.badRequest().body(Map.of("error", "CLIENT_ID_REQUIRED"));

        Appointment a = new Appointment();
        a.setClient(users.getReferenceById(clientId));
        if (req.staffId() != null) a.setStaff(users.getReferenceById(req.staffId()));
        a.setScheduledAt(req.scheduledAt());
        a.setType(req.type() != null ? req.type() : "CONSULTATION");
        a.setNotes(req.notes());
        boolean clientCreated = sender.getRole() == UserRole.CLIENT;
        a.setStatus(clientCreated ? "PENDING" : "CONFIRMED");
        appts.save(a);

        // Notification au staff/admin quand un client crée un rendez-vous
        if (clientCreated) {
            String dateStr = req.scheduledAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm"));
            String typeStr = req.type() != null ? req.type() : "Consultation";
            String msg = sender.getEmail() + " a demandé un rendez-vous\n"
                + typeStr + " · " + dateStr
                + (req.notes() != null ? "\nNote : " + req.notes() : "");

            // Si un staff est désigné → notifier ce staff
            if (req.staffId() != null) {
                AppUser staff = users.findById(req.staffId()).orElse(null);
                if (staff != null) {
                    notifications.notifyInApp(staff, "APPOINTMENT_REQUEST",
                        "Nouveau rendez-vous demandé", msg);
                }
            } else {
                // Sinon → notifier tous les Super Admin et Secrétaires
                users.findByRoleInOrderByEmailAsc(
                    List.of(UserRole.SUPER_ADMIN, UserRole.SECRETARY)
                ).forEach(admin -> notifications.notifyInApp(admin, "APPOINTMENT_REQUEST",
                    "Nouveau rendez-vous demandé", msg));
            }
        }

        return ResponseEntity.ok(ApptDto.from(a));
    }

    @PreAuthorize("hasAnyRole('COACH','NUTRITIONIST','SECRETARY','ADMIN','SUPER_ADMIN')")
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Appointment a = appts.findById(id).orElse(null);
        if (a == null) return ResponseEntity.notFound().build();
        String s = body.get("status");
        if (!List.of("PENDING", "CONFIRMED", "CANCELLED").contains(s))
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_STATUS"));
        a.setStatus(s);

        // Notifier le client du changement de statut
        if (a.getClient() != null) {
            String label = "CONFIRMED".equals(s) ? "confirmé ✓" : "annulé ✕";
            notifications.notifyInApp(a.getClient(), "APPOINTMENT_STATUS",
                "Rendez-vous " + label,
                "Votre rendez-vous du "
                + (a.getScheduledAt() != null
                    ? a.getScheduledAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm"))
                    : "")
                + " a été " + label + ".");
        }

        return ResponseEntity.ok(ApptDto.from(appts.save(a)));
    }

    @PreAuthorize("hasAnyRole('CLIENT','COACH','NUTRITIONIST','SECRETARY','ADMIN','SUPER_ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        AppUser user = SecurityUtil.requireUser();
        Appointment a = appts.findById(id).orElse(null);
        if (a == null) return ResponseEntity.notFound().build();
        if (user.getRole() == UserRole.CLIENT && !a.getClient().getId().equals(user.getId()))
            return ResponseEntity.status(403).build();
        appts.deleteById(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    public record CreateApptRequest(
        Long clientId,
        Long staffId,
        @NotNull LocalDateTime scheduledAt,
        String type,
        String notes
    ) {}

    static class ApptDto {
        public Long   id;
        public Long   clientId;
        public String clientEmail;
        public Long   staffId;
        public String staffEmail;
        public String scheduledAt;
        public String type;
        public String notes;
        public String status;
        public String createdAt;

        static ApptDto from(Appointment a) {
            var d = new ApptDto();
            d.id          = a.getId();
            d.clientId    = a.getClient() == null ? null : a.getClient().getId();
            d.clientEmail = a.getClient() == null ? null : a.getClient().getEmail();
            d.staffId     = a.getStaff()  == null ? null : a.getStaff().getId();
            d.staffEmail  = a.getStaff()  == null ? null : a.getStaff().getEmail();
            d.scheduledAt = a.getScheduledAt() == null ? null : a.getScheduledAt().toString();
            d.type        = a.getType();
            d.notes       = a.getNotes();
            d.status      = a.getStatus();
            d.createdAt   = a.getCreatedAt() == null ? null : a.getCreatedAt().toString();
            return d;
        }
    }
}
