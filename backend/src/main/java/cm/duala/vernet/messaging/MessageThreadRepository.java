package cm.duala.vernet.messaging;

import cm.duala.vernet.user.AppUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageThreadRepository extends JpaRepository<MessageThread, Long> {
	Page<MessageThread> findByClientOrderByCreatedAtDesc(AppUser client, Pageable pageable);
}

