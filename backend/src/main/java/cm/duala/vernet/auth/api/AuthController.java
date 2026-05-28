package cm.duala.vernet.auth.api;

import cm.duala.vernet.auth.jwt.JwtService;
import cm.duala.vernet.auth.totp.TotpService;
import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import cm.duala.vernet.user.UserRole;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
	private final AppUserRepository users;
	private final PasswordEncoder passwordEncoder;
	private final TotpService totpService;
	private final JwtService jwtService;
	private final byte[] jwtSecretBytes;

	public AuthController(
		AppUserRepository users,
		PasswordEncoder passwordEncoder,
		TotpService totpService,
		JwtService jwtService,
		@Value("${app.jwt.secret}") String jwtSecret
	) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.totpService = totpService;
		this.jwtService = jwtService;
		this.jwtSecretBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
	}

	@PostMapping("/register")
	public ResponseEntity<?> register(@RequestBody @Valid AuthDtos.RegisterRequest req) {
		if (users.existsByEmail(req.email())) {
			return ResponseEntity.badRequest().body(Map.of("error", "EMAIL_ALREADY_EXISTS"));
		}

		AppUser u = new AppUser();
		u.setEmail(req.email().toLowerCase().trim());
		u.setPasswordHash(passwordEncoder.encode(req.password()));
		u.setRole(UserRole.valueOf(req.role().toUpperCase()));
		u.setTotpSecret(totpService.generateBase32Secret());
		users.save(u);

		return ResponseEntity.ok(Map.of(
			"userId", u.getId(),
			"email", u.getEmail(),
			"role", u.getRole(),
			"totpSecretBase32", u.getTotpSecret()
		));
	}

	@PostMapping("/login")
	public ResponseEntity<?> login(@RequestBody @Valid AuthDtos.LoginRequest req) {
		AppUser u = users.findByEmail(req.email().toLowerCase().trim()).orElse(null);
		if (u == null || !u.isEnabled() || !passwordEncoder.matches(req.password(), u.getPasswordHash())) {
			return ResponseEntity.status(401).body(Map.of("error", "INVALID_CREDENTIALS"));
		}

		// For this project, 2FA is mandatory. Always require it.
		String pendingToken = createPending2faToken(u);
		return ResponseEntity.ok(new AuthDtos.LoginResponse(true, pendingToken));
	}

	@PostMapping("/verify-2fa")
	public ResponseEntity<?> verify2fa(@RequestBody @Valid AuthDtos.Verify2faRequest req) {
		var claims = Jwts.parser()
			.verifyWith(Keys.hmacShaKeyFor(jwtSecretBytes))
			.build()
			.parseSignedClaims(req.pendingToken())
			.getPayload();

		if (!"PENDING_2FA".equals(String.valueOf(claims.get("type")))) {
			return ResponseEntity.status(401).body(Map.of("error", "INVALID_PENDING_TOKEN"));
		}

		Long userId = Long.valueOf(claims.getSubject());
		AppUser u = users.findById(userId).orElse(null);
		if (u == null || !u.isEnabled()) {
			return ResponseEntity.status(401).body(Map.of("error", "INVALID_USER"));
		}

		if (!totpService.verifyCode(u.getTotpSecret(), req.code())) {
			return ResponseEntity.status(401).body(Map.of("error", "INVALID_2FA_CODE"));
		}

		return ResponseEntity.ok(new AuthDtos.TokenResponse(jwtService.createAccessToken(u)));
	}

	private String createPending2faToken(AppUser user) {
		Instant now = Instant.now();
		Instant exp = now.plusSeconds(5 * 60); // 5 minutes

		return Jwts.builder()
			.issuer("vernet")
			.subject(String.valueOf(user.getId()))
			.issuedAt(Date.from(now))
			.expiration(Date.from(exp))
			.claims(Map.of(
				"type", "PENDING_2FA"
			))
			.signWith(Keys.hmacShaKeyFor(jwtSecretBytes))
			.compact();
	}
}

