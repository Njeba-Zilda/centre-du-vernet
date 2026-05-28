package cm.duala.vernet.messaging;

import cm.duala.vernet.user.AppUser;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
public class MessageThread {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	private AppUser client;

	@ManyToOne(fetch = FetchType.LAZY)
	private AppUser coach;

	@ManyToOne(fetch = FetchType.LAZY)
	private AppUser nutritionist;

	@Column(nullable = false, length = 160)
	private String title;

	private Instant createdAt = Instant.now();
}

