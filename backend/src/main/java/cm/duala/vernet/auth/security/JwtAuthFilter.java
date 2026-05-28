package cm.duala.vernet.auth.security;

import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtAuthFilter extends OncePerRequestFilter {
	private final AppUserRepository userRepository;
	private final byte[] jwtSecretBytes;

	public JwtAuthFilter(AppUserRepository userRepository, byte[] jwtSecretBytes) {
		this.userRepository = userRepository;
		this.jwtSecretBytes = jwtSecretBytes;
	}

	@Override
	protected void doFilterInternal(
		HttpServletRequest request,
		HttpServletResponse response,
		FilterChain filterChain
	) throws ServletException, IOException {
		String header = request.getHeader("Authorization");
		if (header == null || !header.startsWith("Bearer ")) {
			filterChain.doFilter(request, response);
			return;
		}

		String token = header.substring("Bearer ".length()).trim();
		try {
			Claims claims = Jwts.parser()
				.verifyWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(jwtSecretBytes))
				.build()
				.parseSignedClaims(token)
				.getPayload();

			String userId = claims.getSubject();
			String role = String.valueOf(claims.get("role"));

			AppUser user = userRepository.findById(Long.valueOf(userId)).orElse(null);
			if (user != null && user.isEnabled()) {
				var auth = new UsernamePasswordAuthenticationToken(
					user,
					null,
					List.of(new SimpleGrantedAuthority("ROLE_" + role))
				);
				SecurityContextHolder.getContext().setAuthentication(auth);
			}
		} catch (JwtException | IllegalArgumentException ignored) {
			// invalid token => treat as unauthenticated
		}

		filterChain.doFilter(request, response);
	}
}

