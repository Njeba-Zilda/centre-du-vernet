package cm.duala.vernet.audit;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/audit")
public class ActivityLogController {

    private final ActivityLogRepository repo;

    public ActivityLogController(ActivityLogRepository repo) {
        this.repo = repo;
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @GetMapping
    public Map<String, Object> list(
        @RequestParam(defaultValue = "0")  int page,
        @RequestParam(defaultValue = "50") int size
    ) {
        var p = repo.findAllByOrderByCreatedAtDesc(PageRequest.of(Math.max(0, page), Math.min(100, size)));
        return Map.of(
            "items", p.getContent().stream().map(e -> Map.of(
                "id",          e.getId(),
                "action",      e.getAction(),
                "performedBy", e.getPerformedBy() != null ? e.getPerformedBy() : "",
                "targetUser",  e.getTargetUser()  != null ? e.getTargetUser()  : "",
                "details",     e.getDetails()     != null ? e.getDetails()     : "",
                "createdAt",   e.getCreatedAt()   != null ? e.getCreatedAt().toString() : ""
            )).toList(),
            "total", p.getTotalElements(),
            "pages", p.getTotalPages()
        );
    }
}
