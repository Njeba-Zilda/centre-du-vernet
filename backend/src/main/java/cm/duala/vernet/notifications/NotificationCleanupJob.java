package cm.duala.vernet.notifications;

import jakarta.transaction.Transactional;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
public class NotificationCleanupJob {

    private final NotificationRepository repo;

    public NotificationCleanupJob(NotificationRepository repo) {
        this.repo = repo;
    }

    // Supprime les notifications de plus de 24h — tourne toutes les heures
    @Scheduled(fixedRate = 3_600_000)
    @Transactional
    public void deleteOldNotifications() {
        Instant cutoff = Instant.now().minus(24, ChronoUnit.HOURS);
        repo.deleteByCreatedAtBefore(cutoff);
    }
}
