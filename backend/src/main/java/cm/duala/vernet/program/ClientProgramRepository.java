package cm.duala.vernet.program;

import cm.duala.vernet.user.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClientProgramRepository extends JpaRepository<ClientProgram, Long> {
    List<ClientProgram> findByStaffOrderByCreatedAtDesc(AppUser staff);
    List<ClientProgram> findByClientOrderByCreatedAtDesc(AppUser client);
    List<ClientProgram> findAllByOrderByCreatedAtDesc();
    Optional<ClientProgram> findByClientAndStaff(AppUser client, AppUser staff);
}
