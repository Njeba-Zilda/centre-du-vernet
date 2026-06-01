package cm.duala.vernet.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
	Optional<AppUser> findByEmail(String email);
	boolean existsByEmail(String email);
	boolean existsByRole(UserRole role);
	List<AppUser> findByRoleInOrderByEmailAsc(Collection<UserRole> roles);

	@Query("SELECT u FROM AppUser u WHERE u.role = :role AND (" +
		"LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
		"LOWER(COALESCE(u.firstName, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
		"LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :q, '%'))) " +
		"ORDER BY u.email ASC")
	List<AppUser> searchClients(@Param("role") UserRole role, @Param("q") String q);
}

