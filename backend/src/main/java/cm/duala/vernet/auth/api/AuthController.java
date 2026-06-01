package cm.duala.vernet.auth.api;

import cm.duala.vernet.audit.ActivityService;
import cm.duala.vernet.auth.jwt.JwtService;
import cm.duala.vernet.notifications.EmailService;
import cm.duala.vernet.notifications.WhatsAppService;
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

import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Hashtable;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AppUserRepository users;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;
	private final EmailService emailService;
	private final WhatsAppService whatsAppService;
	private final ActivityService activityService;
	private final byte[] jwtSecretBytes;
	private final boolean emailEnabled;

	// Cache 2FA login: userId → {code, expiry}
	private record OtpEntry(String code, Instant expiry) {}
	private final ConcurrentHashMap<Long, OtpEntry> otpCache = new ConcurrentHashMap<>();

	// Cache pré-inscription: token → données complètes + code
	private record PendingReg(
		String email, String passwordHash,
		String firstName, String lastName, String gender,
		String code, Instant expiry
	) {}
	private final ConcurrentHashMap<String, PendingReg> pendingRegCache = new ConcurrentHashMap<>();

	public AuthController(
		AppUserRepository users,
		PasswordEncoder passwordEncoder,
		JwtService jwtService,
		EmailService emailService,
		WhatsAppService whatsAppService,
		ActivityService activityService,
		@Value("${app.jwt.secret}") String jwtSecret,
		@Value("${app.email.enabled:false}") boolean emailEnabled
	) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.emailService = emailService;
		this.activityService = activityService;
		this.whatsAppService = whatsAppService;
		this.jwtSecretBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
		this.emailEnabled = emailEnabled;
	}

	// ── Setup initial : premier Super Admin ─────────────────────────────────

	@PostMapping("/setup")
	public ResponseEntity<?> setup(@RequestBody @Valid AuthDtos.SetupRequest req) {
		if (users.existsByRole(UserRole.SUPER_ADMIN)) {
			return ResponseEntity.status(403).body(Map.of("error", "SETUP_ALREADY_DONE"));
		}

		if (users.existsByEmail(req.email().toLowerCase().trim())) {
			return ResponseEntity.badRequest().body(Map.of("error", "EMAIL_ALREADY_EXISTS"));
		}

		AppUser u = new AppUser();
		u.setEmail(req.email().toLowerCase().trim());
		u.setPasswordHash(passwordEncoder.encode(req.password()));
		u.setRole(UserRole.SUPER_ADMIN);
		u.setFirstName(req.firstName().trim());
		u.setLastName(req.lastName().trim());
		u.setGender(req.gender().trim().toUpperCase());
		users.save(u);

		return ResponseEntity.ok(Map.of(
			"message", "Super Admin créé avec succès. Cet endpoint est maintenant désactivé.",
			"email", u.getEmail()
		));
	}

	// ── Étape 1 : envoi du code de vérification ─────────────────────────────

	@PostMapping("/pre-register")
	public ResponseEntity<?> preRegister(@RequestBody @Valid AuthDtos.PreRegisterRequest req) {

		String email = req.email().toLowerCase().trim();

		if (users.existsByEmail(email)) {
			return ResponseEntity.badRequest().body(Map.of("error", "EMAIL_ALREADY_EXISTS"));
		}

		if (!emailDomainExists(email)) {
			return ResponseEntity.badRequest().body(Map.of("error", "INVALID_EMAIL_DOMAIN"));
		}

		if ("WHATSAPP".equalsIgnoreCase(req.channel())
				&& (req.phone() == null || req.phone().isBlank())) {
			return ResponseEntity.badRequest().body(Map.of("error", "PHONE_REQUIRED"));
		}

		String code = String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
		String token = generateSecureToken();

		pendingRegCache.put(token, new PendingReg(
			email,
			passwordEncoder.encode(req.password()),
			req.firstName().trim(),
			req.lastName().trim(),
			req.gender().trim().toUpperCase(),
			code,
			Instant.now().plusSeconds(10 * 60)
		));

		String devCode = null;
		if (emailEnabled) {
			try {
				if ("WHATSAPP".equalsIgnoreCase(req.channel())) {
					whatsAppService.send(
						req.phone().trim(),
						"Bonjour " + req.firstName().trim() + ",\n\n" +
						"Votre code de vérification Centre du Vernet : *" + code + "*\n" +
						"Valable 10 minutes."
					);
				} else {
					emailService.send(
						email,
						"Vérification de votre email — Centre du Vernet",
						"Bonjour " + req.firstName().trim() + ",\n\n" +
						"Votre code de vérification pour créer votre compte au Centre du Vernet est :\n\n" +
						"     " + code + "\n\n" +
						"Ce code est valable 10 minutes.\n\n" +
						"Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\n" +
						"Centre du Vernet — Douala, Cameroun"
					);
				}
			} catch (Exception e) {
				pendingRegCache.remove(token);
				return ResponseEntity.status(502).body(Map.of("error", "SEND_FAILED",
					"message", e.getMessage()));
			}
		} else {
			// Mode dev : affiche le code directement à l'écran
			devCode = code;
		}

		return ResponseEntity.ok(new AuthDtos.PreRegisterResponse(token, devCode));
	}

	// ── Étape 2 : validation du code et création du compte ──────────────────

	@PostMapping("/register")
	public ResponseEntity<?> register(@RequestBody @Valid AuthDtos.RegisterRequest req) {

		PendingReg pending = pendingRegCache.get(req.pendingToken());
		if (pending == null) {
			return ResponseEntity.badRequest().body(Map.of("error", "INVALID_OR_EXPIRED_TOKEN"));
		}
		if (pending.expiry().isBefore(Instant.now())) {
			pendingRegCache.remove(req.pendingToken());
			return ResponseEntity.badRequest().body(Map.of("error", "CODE_EXPIRED"));
		}
		if (!pending.code().equals(req.code().trim())) {
			return ResponseEntity.badRequest().body(Map.of("error", "INVALID_CODE"));
		}

		// Vérification finale (double inscription simultanée)
		if (users.existsByEmail(pending.email())) {
			pendingRegCache.remove(req.pendingToken());
			return ResponseEntity.badRequest().body(Map.of("error", "EMAIL_ALREADY_EXISTS"));
		}

		AppUser u = new AppUser();
		u.setEmail(pending.email());
		u.setPasswordHash(pending.passwordHash());
		u.setRole(UserRole.CLIENT);
		u.setFirstName(pending.firstName());
		u.setLastName(pending.lastName());
		u.setGender(pending.gender());
		users.save(u);

		pendingRegCache.remove(req.pendingToken());

		return ResponseEntity.ok(Map.of(
			"userId", u.getId(),
			"email", u.getEmail(),
			"role", u.getRole()
		));
	}

	// ── Login ────────────────────────────────────────────────────────────────

	@PostMapping("/login")
	public ResponseEntity<?> login(@RequestBody @Valid AuthDtos.LoginRequest req) {
		AppUser u = users.findByEmail(req.email().toLowerCase().trim()).orElse(null);
		if (u == null || !u.isEnabled() || !passwordEncoder.matches(req.password(), u.getPasswordHash())) {
			return ResponseEntity.status(401).body(Map.of("error", "INVALID_CREDENTIALS"));
		}

		String code = String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
		otpCache.put(u.getId(), new OtpEntry(code, Instant.now().plusSeconds(10 * 60)));

		String devCode = null;
		if (emailEnabled) {
			try {
				emailService.send(
					u.getEmail(),
					"Code de connexion – Centre du Vernet",
					"Bonjour,\n\nVotre code de connexion est : " + code +
					"\n\nIl est valable 10 minutes.\n\nCentre du Vernet – Douala"
				);
			} catch (Exception ignored) {
				devCode = code;
			}
		} else {
			devCode = code;
		}

		String pendingToken = createPendingToken(u);
		return ResponseEntity.ok(new AuthDtos.LoginResponse(true, pendingToken, u.getEmail(), devCode));
	}

	// ── Verify 2FA ───────────────────────────────────────────────────────────

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

		OtpEntry entry = otpCache.get(userId);
		if (entry == null || entry.expiry().isBefore(Instant.now())) {
			return ResponseEntity.status(401).body(Map.of("error", "CODE_EXPIRED"));
		}
		if (!entry.code().equals(req.code().trim())) {
			return ResponseEntity.status(401).body(Map.of("error", "INVALID_2FA_CODE"));
		}
		otpCache.remove(userId);

		AppUser u = users.findById(userId).orElse(null);
		if (u == null || !u.isEnabled()) {
			return ResponseEntity.status(401).body(Map.of("error", "INVALID_USER"));
		}

		activityService.log("LOGIN", u.getEmail(), null, "Connexion réussie");
		return ResponseEntity.ok(new AuthDtos.TokenResponse(jwtService.createAccessToken(u)));
	}

	// ── Utilitaires privés ───────────────────────────────────────────────────

	private String createPendingToken(AppUser user) {
		Instant now = Instant.now();
		return Jwts.builder()
			.issuer("vernet")
			.subject(String.valueOf(user.getId()))
			.issuedAt(Date.from(now))
			.expiration(Date.from(now.plusSeconds(10 * 60)))
			.claims(Map.of("type", "PENDING_2FA"))
			.signWith(Keys.hmacShaKeyFor(jwtSecretBytes))
			.compact();
	}

	private boolean emailDomainExists(String email) {
		try {
			String domain = email.substring(email.lastIndexOf('@') + 1);
			Hashtable<String, String> env = new Hashtable<>();
			env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
			env.put("java.naming.provider.url", "dns:");
			DirContext ctx = new InitialDirContext(env);
			Attributes mx = ctx.getAttributes(domain, new String[]{"MX"}).get("MX") != null
				? ctx.getAttributes(domain, new String[]{"MX"})
				: null;
			if (mx != null) return true;
			// Fallback : domaine sans MX mais avec A record (certains domaines valides)
			return ctx.getAttributes(domain, new String[]{"A"}).get("A") != null;
		} catch (javax.naming.NameNotFoundException e) {
			return false; // domaine inconnu du DNS
		} catch (Exception e) {
			return true; // DNS injoignable → on laisse passer, le code servira de filtre
		}
	}

	private String generateSecureToken() {
		byte[] bytes = new byte[24];
		new SecureRandom().nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}
}
