package cm.duala.vernet.notifications;

import cm.duala.vernet.user.AppUser;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
public class Notification {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	private AppUser user;

	@Column(nullable = false, length = 64)
	private String type; // e.g. APPOINTMENT_REMINDER, MESSAGE, ALERT

	@Column(nullable = false, length = 160)
	private String title;

	@Column(nullable = false, length = 2000)
	private String body;

	@Column(nullable = false)
	private boolean read = false;

	private Instant createdAt = Instant.now();
}

