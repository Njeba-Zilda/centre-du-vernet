package cm.duala.vernet;

import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import cm.duala.vernet.user.UserRole;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements ApplicationRunner {

	private final AppUserRepository users;
	private final PasswordEncoder passwordEncoder;

	public DataInitializer(AppUserRepository users, PasswordEncoder passwordEncoder) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
	}

	private static final String ADMIN_EMAIL    = "znjeba@gmail.com";
	private static final String ADMIN_PASSWORD = "vernet2026";

	@Override
	public void run(ApplicationArguments args) {
		AppUser admin = users.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
			AppUser u = new AppUser();
			u.setEmail(ADMIN_EMAIL);
			u.setRole(UserRole.SUPER_ADMIN);
			u.setFirstName("Alida");
			u.setLastName("Beri");
			u.setGender("F");
			return u;
		});

		// Toujours synchroniser le mot de passe au démarrage
		admin.setPasswordHash(passwordEncoder.encode(ADMIN_PASSWORD));
		users.save(admin);

		System.out.println(">>> Super Admin prêt : " + ADMIN_EMAIL + " / " + ADMIN_PASSWORD);
	}
}
