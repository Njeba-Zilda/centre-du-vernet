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
	private String storageKey; // random id used as filename

	private Instant createdAt = Instant.now();
}

