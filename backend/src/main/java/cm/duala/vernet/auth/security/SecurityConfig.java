package cm.duala.vernet.auth.security;

import cm.duala.vernet.user.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.nio.charset.StandardCharsets;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
	@Bean
	SecurityFilterChain securityFilterChain(
		HttpSecurity http,
		AppUserRepository userRepository,
		@Value("${app.jwt.secret}") String jwtSecret
	) throws Exception {
		var jwtFilter = new JwtAuthFilter(userRepository, jwtSecret.getBytes(StandardCharsets.UTF_8));

		http
			.csrf(csrf -> csrf.disable())
			.sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(auth -> auth
				.requestMatchers("/api/health", "/api/auth/**").permitAll()
				.anyRequest().authenticated()
			)
			.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
			.httpBasic(Customizer.withDefaults());

		return http.build();
	}
}

