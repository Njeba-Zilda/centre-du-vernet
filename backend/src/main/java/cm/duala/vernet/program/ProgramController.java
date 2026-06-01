package cm.duala.vernet.program;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import cm.duala.vernet.user.UserRole;
import jakarta.transaction.Transactional;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

@RestController
@RequestMapping("/api/programs")
public class ProgramController {

    private final ClientProgramRepository programs;
    private final WeeklyPlanRepository    plans;
    private final AppUserRepository       users;

    public ProgramController(ClientProgramRepository programs, WeeklyPlanRepository plans, AppUserRepository users) {
        this.programs = programs;
        this.plans    = plans;
        this.users    = users;
    }

    // ── Lister les programmes ──────────────────────────────────────────────────
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
    @GetMapping
    public List<Map<String, Object>> list() {
        AppUser me = SecurityUtil.requireUser();
        List<ClientProgram> list = switch (me.getRole()) {
            case SUPER_ADMIN, ADMIN -> programs.findAllByOrderByCreatedAtDesc();
            case CLIENT             -> programs.findByClientOrderByCreatedAtDesc(me);
            default                 -> programs.findByStaffOrderByCreatedAtDesc(me);
        };
        return list.stream().map(p -> programSummary(p)).toList();
    }

    // ── Récupérer un programme complet avec ses plans ─────────────────────────
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        AppUser me = SecurityUtil.requireUser();
        ClientProgram p = programs.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        if (!canAccess(me, p)) return ResponseEntity.status(403).build();

        List<WeeklyPlan> weekPlans = plans.findByProgramOrderByWeekNumberAsc(p);

        // Construire les semaines (y compris les semaines vides jusqu'à durationWeeks)
        var weeks = IntStream.rangeClosed(1, p.getDurationWeeks()).mapToObj(w -> {
            WeeklyPlan wp = weekPlans.stream().filter(x -> x.getWeekNumber() == w).findFirst().orElse(null);
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("weekNumber",  w);
            d.put("objectives",  wp != null && wp.getObjectives() != null ? wp.getObjectives() : "");
            d.put("plan",        wp != null && wp.getPlan()       != null ? wp.getPlan()       : "");
            d.put("results",     wp != null && wp.getResults()    != null ? wp.getResults()    : "");
            d.put("notes",       wp != null && wp.getNotes()      != null ? wp.getNotes()      : "");
            d.put("completed",   wp != null && wp.isCompleted());
            d.put("id",          wp != null ? wp.getId() : null);
            return d;
        }).toList();

        Map<String, Object> resp = new LinkedHashMap<>(programSummary(p));
        resp.put("weeks", weeks);
        return ResponseEntity.ok(resp);
    }

    // ── Créer un programme ────────────────────────────────────────────────────
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST')")
    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateProgramRequest req) {
        AppUser me = SecurityUtil.requireUser();
        AppUser client = users.findById(req.clientId()).orElse(null);
        if (client == null) return ResponseEntity.badRequest().body(Map.of("error", "CLIENT_NOT_FOUND"));
        if (req.durationWeeks() < 6 || req.durationWeeks() > 8)
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_DURATION"));

        ClientProgram p = new ClientProgram();
        p.setClient(client);
        p.setStaff(me);
        p.setDurationWeeks(req.durationWeeks());
        p.setStartDate(req.startDate() != null ? req.startDate() : LocalDate.now());
        p.setStatus("ACTIVE");
        programs.save(p);

        return ResponseEntity.ok(programSummary(p));
    }

    // ── Mettre à jour un programme (durée, date début, statut) ────────────────
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST')")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody UpdateProgramRequest req) {
        AppUser me = SecurityUtil.requireUser();
        ClientProgram p = programs.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        if (!canAccess(me, p)) return ResponseEntity.status(403).build();

        if (req.durationWeeks() != null && req.durationWeeks() >= 6 && req.durationWeeks() <= 8)
            p.setDurationWeeks(req.durationWeeks());
        if (req.startDate() != null) p.setStartDate(req.startDate());
        if (req.status()    != null) p.setStatus(req.status());

        return ResponseEntity.ok(programSummary(programs.save(p)));
    }

    // ── Sauvegarder un plan de semaine ────────────────────────────────────────
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST')")
    @Transactional
    @PutMapping("/{id}/weeks/{weekNumber}")
    public ResponseEntity<?> saveWeek(
        @PathVariable Long id,
        @PathVariable int weekNumber,
        @RequestBody SaveWeekRequest req
    ) {
        AppUser me = SecurityUtil.requireUser();
        ClientProgram p = programs.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        if (!canAccess(me, p)) return ResponseEntity.status(403).build();
        if (weekNumber < 1 || weekNumber > p.getDurationWeeks())
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_WEEK"));

        WeeklyPlan wp = plans.findByProgramAndWeekNumber(p, weekNumber)
            .orElseGet(() -> { WeeklyPlan n = new WeeklyPlan(); n.setProgram(p); n.setWeekNumber(weekNumber); return n; });

        if (req.objectives() != null) wp.setObjectives(req.objectives());
        if (req.plan()       != null) wp.setPlan(req.plan());
        if (req.results()    != null) wp.setResults(req.results());
        if (req.notes()      != null) wp.setNotes(req.notes());
        if (req.completed()  != null) wp.setCompleted(req.completed());
        wp.setUpdatedAt(Instant.now());
        plans.save(wp);

        return ResponseEntity.ok(Map.of("saved", true, "weekNumber", weekNumber));
    }

    // ── Supprimer un programme ────────────────────────────────────────────────
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST')")
    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        AppUser me = SecurityUtil.requireUser();
        ClientProgram p = programs.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        if (!canAccess(me, p)) return ResponseEntity.status(403).build();
        plans.deleteAll(plans.findByProgramOrderByWeekNumberAsc(p));
        programs.deleteById(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean canAccess(AppUser me, ClientProgram p) {
        return me.getRole() == UserRole.SUPER_ADMIN
            || me.getRole() == UserRole.ADMIN
            || p.getStaff().getId().equals(me.getId())
            || p.getClient().getId().equals(me.getId());
    }

    private Map<String, Object> programSummary(ClientProgram p) {
        long completedWeeks = plans.findByProgramOrderByWeekNumberAsc(p).stream()
            .filter(WeeklyPlan::isCompleted).count();
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("id",            p.getId());
        d.put("clientId",      p.getClient().getId());
        d.put("clientEmail",   p.getClient().getEmail());
        d.put("clientName",    fullName(p.getClient()));
        d.put("staffId",       p.getStaff().getId());
        d.put("staffEmail",    p.getStaff().getEmail());
        d.put("staffName",     fullName(p.getStaff()));
        d.put("staffRole",     p.getStaff().getRole().name());
        d.put("durationWeeks", p.getDurationWeeks());
        d.put("startDate",     p.getStartDate() != null ? p.getStartDate().toString() : null);
        d.put("status",        p.getStatus());
        d.put("completedWeeks", completedWeeks);
        d.put("createdAt",     p.getCreatedAt() != null ? p.getCreatedAt().toString() : null);
        return d;
    }

    private String fullName(AppUser u) {
        if (u.getFirstName() != null || u.getLastName() != null)
            return ((u.getFirstName() != null ? u.getFirstName() : "") + " "
                + (u.getLastName() != null ? u.getLastName() : "")).trim();
        return u.getEmail().split("@")[0];
    }

    public record CreateProgramRequest(Long clientId, int durationWeeks, LocalDate startDate) {}
    public record UpdateProgramRequest(Integer durationWeeks, LocalDate startDate, String status) {}
    public record SaveWeekRequest(String objectives, String plan, String results, String notes, Boolean completed) {}
}
