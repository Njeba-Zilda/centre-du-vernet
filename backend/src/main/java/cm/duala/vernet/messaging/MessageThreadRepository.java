package cm.duala.vernet.messaging;

import cm.duala.vernet.user.AppUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageThreadRepository extends JpaRepository<MessageThread, Long> {
	Page<MessageThread> findByClientOrderByCreatedAtDesc(AppUser client, Pageable pageable);
	long countByClient(AppUser client);
	java.util.List<MessageThread> findByClient(AppUser client);

	@org.springframework.data.jpa.repository.Query(
		"SELECT t FROM MessageThread t WHERE t.coach = :user OR t.nutritionist = :user OR t.staff = :user ORDER BY t.createdAt DESC")
	Page<MessageThread> findByStaffParticipant(
		@org.springframework.data.repository.query.Param("user") AppUser user,
		Pageable pageable);

	@org.springframework.data.jpa.repository.Modifying
	@org.springframework.data.jpa.repository.Query("UPDATE MessageThread t SET t.coach = null WHERE t.coach = :user")
	void clearCoachRef(@org.springframework.data.repository.query.Param("user") AppUser user);

	@org.springframework.data.jpa.repository.Modifying
	@org.springframework.data.jpa.repository.Query("UPDATE MessageThread t SET t.nutritionist = null WHERE t.nutritionist = :user")
	void clearNutritionistRef(@org.springframework.data.repository.query.Param("user") AppUser user);

	@org.springframework.data.jpa.repository.Modifying
	@org.springframework.data.jpa.repository.Query("UPDATE MessageThread t SET t.staff = null WHERE t.staff = :user")
	void clearStaffRef2(@org.springframework.data.repository.query.Param("user") AppUser user);
}

