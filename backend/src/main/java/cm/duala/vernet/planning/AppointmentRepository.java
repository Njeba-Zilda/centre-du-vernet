package cm.duala.vernet.planning;

import cm.duala.vernet.user.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    List<Appointment> findByClientOrderByScheduledAtAsc(AppUser client);
    List<Appointment> findByStaffOrderByScheduledAtAsc(AppUser staff);
    List<Appointment> findAllByOrderByScheduledAtAsc();
    void deleteByClient(AppUser client);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE Appointment a SET a.staff = null WHERE a.staff = :user")
    void clearStaffRef(@org.springframework.data.repository.query.Param("user") AppUser user);
}
