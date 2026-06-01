package cm.duala.vernet.weight.api;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import cm.duala.vernet.user.UserRole;
import cm.duala.vernet.weight.WeightEntry;
import cm.duala.vernet.weight.WeightEntryRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/weight")
public class WeightController {

    private final WeightEntryRepository entries;
    private final AppUserRepository users;

    public WeightController(WeightEntryRepository entries, AppUserRepository users) {
        this.entries = entries;
        this.users = users;
    }

    @PreAuthorize("hasAnyRole('CLIENT','COACH','NUTRITIONIST','SECRETARY','ADMIN','SUPER_ADMIN')")
    @GetMapping
    public List<WeightDto> myEntries() {
        return entries.findByClientOrderByDateAsc(SecurityUtil.requireUser())
            .stream().map(WeightDto::from).toList();
    }

    @PreAuthorize("hasAnyRole('COACH','NUTRITIONIST','SECRETARY','ADMIN','SUPER_ADMIN')")
    @GetMapping("/client/{clientId}")
    public ResponseEntity<?> clientEntries(@PathVariable Long clientId) {
        AppUser client = users.findById(clientId).orElse(null);
        if (client == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(entries.findByClientOrderByDateAsc(client).stream().map(WeightDto::from).toList());
    }

    @PreAuthorize("hasAnyRole('CLIENT','COACH','NUTRITIONIST','SECRETARY','ADMIN','SUPER_ADMIN')")
    @PostMapping
    public ResponseEntity<?> addEntry(@RequestBody @Valid AddWeightRequest req) {
        AppUser sender = SecurityUtil.requireUser();
        AppUser client = (req.clientId() != null && sender.getRole() != UserRole.CLIENT)
            ? users.findById(req.clientId()).orElse(sender)
            : sender;
        WeightEntry e = new WeightEntry();
        e.setClient(client);
        e.setDate(req.date() != null ? req.date() : LocalDate.now());
        e.setWeightKg(req.weightKg());
        e.setHeightCm(req.heightCm());
        e.setWaistCm(req.waistCm());
        e.setHipsCm(req.hipsCm());
        e.setChestCm(req.chestCm());
        e.setNotes(req.notes());
        return ResponseEntity.ok(WeightDto.from(entries.save(e)));
    }

    @PreAuthorize("hasAnyRole('CLIENT','COACH','NUTRITIONIST','SECRETARY','ADMIN','SUPER_ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteEntry(@PathVariable Long id) {
        AppUser user = SecurityUtil.requireUser();
        WeightEntry e = entries.findById(id).orElse(null);
        if (e == null) return ResponseEntity.notFound().build();
        if (user.getRole() == UserRole.CLIENT && !e.getClient().getId().equals(user.getId()))
            return ResponseEntity.status(403).build();
        entries.deleteById(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    // ── Objectif de poids ──────────────────────────────────────────────────────

    @PreAuthorize("hasAnyRole('CLIENT','COACH','NUTRITIONIST','SECRETARY','ADMIN','SUPER_ADMIN')")
    @GetMapping("/goal")
    public ResponseEntity<?> getGoal() {
        AppUser u = SecurityUtil.requireUser();
        return ResponseEntity.ok(Map.of(
            "targetWeightKg", u.getTargetWeightKg() != null ? u.getTargetWeightKg() : "",
            "targetDate",     u.getTargetDate()     != null ? u.getTargetDate().toString() : ""
        ));
    }

    @PreAuthorize("hasAnyRole('CLIENT','COACH','NUTRITIONIST','SECRETARY','ADMIN','SUPER_ADMIN')")
    @PutMapping("/goal")
    public ResponseEntity<?> setGoal(@RequestBody GoalRequest req) {
        AppUser u = SecurityUtil.requireUser();
        u.setTargetWeightKg(req.targetWeightKg());
        u.setTargetDate(req.targetDate());
        users.save(u);
        return ResponseEntity.ok(Map.of("updated", true));
    }

    public record GoalRequest(Double targetWeightKg, LocalDate targetDate) {}

    public record AddWeightRequest(
        Long clientId,
        LocalDate date,
        @NotNull Double weightKg,
        Double heightCm,
        Double waistCm,
        Double hipsCm,
        Double chestCm,
        String notes
    ) {}

    static class WeightDto {
        public Long   id;
        public String date;
        public Double weightKg;
        public Double heightCm;
        public Double waistCm;
        public Double hipsCm;
        public Double chestCm;
        public Double bmi;
        public String notes;

        static WeightDto from(WeightEntry e) {
            var d = new WeightDto();
            d.id       = e.getId();
            d.date     = e.getDate().toString();
            d.weightKg = e.getWeightKg();
            d.heightCm = e.getHeightCm();
            d.waistCm  = e.getWaistCm();
            d.hipsCm   = e.getHipsCm();
            d.chestCm  = e.getChestCm();
            if (e.getHeightCm() != null && e.getHeightCm() > 0) {
                double h = e.getHeightCm() / 100.0;
                d.bmi = Math.round((e.getWeightKg() / (h * h)) * 10.0) / 10.0;
            }
            d.notes = e.getNotes();
            return d;
        }
    }
}
