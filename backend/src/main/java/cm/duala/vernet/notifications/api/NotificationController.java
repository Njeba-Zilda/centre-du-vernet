package cm.duala.vernet.notifications.api;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.notifications.Notification;
import cm.duala.vernet.notifications.NotificationRepository;
import cm.duala.vernet.user.AppUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

	private static final long TTL_HOURS = 24;

	private final NotificationRepository repo;

	public NotificationController(NotificationRepository repo) {
		this.repo = repo;
	}

	private Instant cutoff() {
		return Instant.now().minus(TTL_HOURS, ChronoUnit.HOURS);
	}

	@GetMapping
	public Map<String, Object> list(@RequestParam(defaultValue = "0") int page,
	                                @RequestParam(defaultValue = "50") int size) {
		AppUser u = SecurityUtil.requireUser();
		var p = repo.findByUserAndCreatedAtAfterOrderByCreatedAtDesc(
			u, cutoff(), PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size))));
		return Map.of(
			"items", p.getContent().stream().map(NotificationDto::from).toList(),
			"page",  p.getNumber(),
			"size",  p.getSize(),
			"total", p.getTotalElements()
		);
	}

	@GetMapping("/unread-count")
	public Map<String, Object> unreadCount() {
		AppUser u = SecurityUtil.requireUser();
		long count = repo.countByUserAndReadIsFalseAndCreatedAtAfter(u, cutoff());
		return Map.of("unread", count);
	}

	@PostMapping("/read-all")
	public ResponseEntity<?> markAllRead() {
		AppUser u = SecurityUtil.requireUser();
		var unread = repo.findByUserAndCreatedAtAfterOrderByCreatedAtDesc(
			u, cutoff(), PageRequest.of(0, 200))
			.getContent().stream().filter(n -> !n.isRead()).toList();
		unread.forEach(n -> { n.setRead(true); repo.save(n); });
		return ResponseEntity.ok(Map.of("marked", unread.size()));
	}

	@PostMapping("/{id}/read")
	public ResponseEntity<?> markRead(@PathVariable Long id) {
		AppUser u = SecurityUtil.requireUser();
		Notification n = repo.findById(id).orElse(null);
		if (n == null || !n.getUser().getId().equals(u.getId()))
			return ResponseEntity.status(404).body(Map.of("error", "NOT_FOUND"));
		n.setRead(true);
		repo.save(n);
		return ResponseEntity.ok(Map.of("ok", true));
	}

	static class NotificationDto {
		public Long   id;
		public String type;
		public String title;
		public String body;
		public boolean read;
		public String createdAt;

		static NotificationDto from(Notification n) {
			NotificationDto d = new NotificationDto();
			d.id        = n.getId();
			d.type      = n.getType();
			d.title     = n.getTitle();
			d.body      = n.getBody();
			d.read      = n.isRead();
			d.createdAt = n.getCreatedAt() == null ? null : n.getCreatedAt().toString();
			return d;
		}
	}
}
