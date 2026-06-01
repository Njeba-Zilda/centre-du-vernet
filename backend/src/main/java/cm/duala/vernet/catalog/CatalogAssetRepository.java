package cm.duala.vernet.catalog;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CatalogAssetRepository extends JpaRepository<CatalogAsset, Long> {
	Page<CatalogAsset> findAllByOrderByCreatedAtDesc(Pageable pageable);

	java.util.List<CatalogAsset> findBySharedWithClientOrderByCreatedAtDesc(
		cm.duala.vernet.user.AppUser client);
}

