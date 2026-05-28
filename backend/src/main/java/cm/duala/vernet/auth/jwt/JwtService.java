package cm.duala.vernet.auth.jwt;

import cm.duala.vernet.user.AppUser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {
	private final SecretKey key;
	private final String issuer;
	private final long accessTtlSeconds;

	public JwtService(
		@Value("${app.jwt.secret}") String secret,
		@Value("${app.jwt.issuer:vernet}") String issuer,
		@Value("${app.jwt.access-ttl-seconds:3600}") long accessTtlSeconds
	) {
		this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
		this.issuer = issuer;
		this.accessTtlSeconds = accessTtlSeconds;
	}

	public String createAccessToken(AppUser user) {
		Instant now = Instant.now();
		Instant exp = now.plusSeconds(accessTtlSeconds);

		return Jwts.builder()
			.issuer(issuer)
			.subject(String.valueOf(user.getId()))
			.issuedAt(Date.from(now))
			.expiration(Date.from(exp))
			.claims(Map.of(
				"email", user.getEmail(),
				"role", user.getRole().name()
			))
			.signWith(key)
			.compact();
	}

	public SecretKey getKey() {
		return key;
	}
}

