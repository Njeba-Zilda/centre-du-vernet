package cm.duala.vernet.audit;

import org.springframework.stereotype.Service;

@Service
public class ActivityService {

    private final ActivityLogRepository repo;

    public ActivityService(ActivityLogRepository repo) {
        this.repo = repo;
    }

    public void log(String action, String performedBy, String targetUser, String details) {
        ActivityLog entry = new ActivityLog();
        entry.setAction(action);
        entry.setPerformedBy(performedBy);
        entry.setTargetUser(targetUser);
        entry.setDetails(details);
        repo.save(entry);
    }
}
