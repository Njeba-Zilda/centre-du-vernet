package cm.duala.vernet.notifications;

import cm.duala.vernet.user.AppUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
	Page<Notification> findByUserOrderByCreatedAtDesc(AppUser user, Pageable pageable);
	Page<Notification> findByUserAndCreatedAtAfterOrderByCreatedAtDesc(AppUser user, java.time.Instant since, Pageable pageable);
	long countByUserAndReadIsFalseAndCreatedAtAfter(AppUser user, java.time.Instant since);
	void deleteByUser(AppUser user);
	void deleteByCreatedAtBefore(java.time.Instant cutoff);
}

