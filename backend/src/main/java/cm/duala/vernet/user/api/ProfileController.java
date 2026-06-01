package cm.duala.vernet.user.api;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;

    public ProfileController(AppUserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    // ── Récupérer son profil ──────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<?> getProfile() {
        AppUser u = SecurityUtil.requireUser();
        return ResponseEntity.ok(toDto(u));
    }

    // ── Modifier son profil (nom, prénom, téléphone) ──────────────────────────
    @PutMapping
    public ResponseEntity<?> updateProfile(@RequestBody UpdateProfileRequest req) {
        AppUser u = SecurityUtil.requireUser();
        if (req.firstName()   != null && !req.firstName().isBlank()) u.setFirstName(req.firstName().trim());
        if (req.lastName()    != null && !req.lastName().isBlank())  u.setLastName(req.lastName().trim());
        if (req.phone()       != null) u.setPhone(req.phone().trim());
        if (req.dateOfBirth() != null) u.setDateOfBirth(req.dateOfBirth());
        return ResponseEntity.ok(toDto(users.save(u)));
    }

    // ── Changer son mot de passe ──────────────────────────────────────────────
    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest req) {
        AppUser u = SecurityUtil.requireUser();
        if (!passwordEncoder.matches(req.currentPassword(), u.getPasswordHash())) {
            return ResponseEntity.badRequest().body(Map.of("error", "WRONG_CURRENT_PASSWORD"));
        }
        if (req.newPassword().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "PASSWORD_TOO_SHORT"));
        }
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        users.save(u);
        return ResponseEntity.ok(Map.of("updated", true));
    }

    private Map<String, Object> toDto(AppUser u) {
        int age = 0;
        if (u.getDateOfBirth() != null) {
            age = java.time.Period.between(u.getDateOfBirth(), java.time.LocalDate.now()).getYears();
        }
        var map = new java.util.LinkedHashMap<String, Object>();
        map.put("id",          u.getId());
        map.put("email",       u.getEmail());
        map.put("firstName",   u.getFirstName()  != null ? u.getFirstName()  : "");
        map.put("lastName",    u.getLastName()   != null ? u.getLastName()   : "");
        map.put("gender",      u.getGender()     != null ? u.getGender()     : "");
        map.put("phone",       u.getPhone()      != null ? u.getPhone()      : "");
        map.put("dateOfBirth", u.getDateOfBirth() != null ? u.getDateOfBirth().toString() : "");
        map.put("age",         age);
        map.put("role",        u.getRole().name());
        map.put("createdAt",   u.getCreatedAt() != null ? u.getCreatedAt().toString() : "");
        return map;
    }

    public record UpdateProfileRequest(String firstName, String lastName, String phone, java.time.LocalDate dateOfBirth) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min = 6) String newPassword) {}
}
