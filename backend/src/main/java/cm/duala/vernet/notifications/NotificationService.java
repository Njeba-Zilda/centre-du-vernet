package cm.duala.vernet.notifications;

import cm.duala.vernet.user.AppUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {
	private final NotificationRepository repo;
	private final EmailService emailService;
	private final boolean emailEnabled;

	public NotificationService(
		NotificationRepository repo,
		EmailService emailService,
		@Value("${app.email.enabled:false}") boolean emailEnabled
	) {
		this.repo = repo;
		this.emailService = emailService;
		this.emailEnabled = emailEnabled;
	}

	public Notification notifyInApp(AppUser user, String type, String title, String body) {
		Notification n = new Notification();
		n.setUser(user);
		n.setType(type);
		n.setTitle(title);
		n.setBody(body);
		return repo.save(n);
	}

	public void notifyInAppAndEmail(AppUser user, String type, String title, String body) {
		notifyInApp(user, type, title, body);
		if (emailEnabled) {
			emailService.send(user.getEmail(), title, body);
		}
	}
}

