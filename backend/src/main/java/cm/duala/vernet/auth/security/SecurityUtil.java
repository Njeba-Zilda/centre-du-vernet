package cm.duala.vernet.auth.security;

import cm.duala.vernet.user.AppUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public class SecurityUtil {
	private SecurityUtil() {}

	public static AppUser requireUser() {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (auth == null || !(auth.getPrincipal() instanceof AppUser user)) {
			throw new RuntimeException("UNAUTHENTICATED");
		}
		return user;
	}
}

