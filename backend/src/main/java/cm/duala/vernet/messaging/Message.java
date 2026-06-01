package cm.duala.vernet.messaging;

import cm.duala.vernet.catalog.CatalogAsset;
import cm.duala.vernet.user.AppUser;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
public class Message {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	private MessageThread thread;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	private AppUser sender;

	@Column(length = 4000)
	private String text;

	@ManyToOne(fetch = FetchType.LAZY)
	private CatalogAsset attachment; // optional: document/photo/pdf from catalog

	private Instant createdAt = Instant.now();
	private Instant editedAt;
	private Instant readAt;
}

