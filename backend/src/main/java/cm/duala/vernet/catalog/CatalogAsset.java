package cm.duala.vernet.catalog;

import cm.duala.vernet.user.AppUser;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
public class CatalogAsset {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	private AppUser uploadedBy;

	@Column(nullable = false, length = 260)
	private String originalFilename;

	@Column(nullable = false, length = 120)
	private String contentType;

	@Column(nullable = false)
	private long sizeBytes;

	@Column(nullable = false, length = 64)
	private String storageKey;

	@Column(length = 60)
	private String category; // ex: "Régimes", "Exercices", "Bilans"

	@ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
	private cm.duala.vernet.user.AppUser sharedWithClient; // partage direct vers 1 client

	private Instant createdAt = Instant.now();
}

