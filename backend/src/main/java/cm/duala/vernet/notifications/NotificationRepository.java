package cm.duala.vernet.notifications;

import cm.duala.vernet.user.AppUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
	Page<Notification> findByUserOrderByCreatedAtDesc(AppUser user, Pageable pageable);
	long countByUserAndReadIsFalse(AppUser user);
}

