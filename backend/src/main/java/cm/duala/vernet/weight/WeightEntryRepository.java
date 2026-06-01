package cm.duala.vernet.weight;

import cm.duala.vernet.user.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WeightEntryRepository extends JpaRepository<WeightEntry, Long> {
    List<WeightEntry> findByClientOrderByDateAsc(AppUser client);
    long countByClient(AppUser client);
    void deleteByClient(AppUser client);
}
