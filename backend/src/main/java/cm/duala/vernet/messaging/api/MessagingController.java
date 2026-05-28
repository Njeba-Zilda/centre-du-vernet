package cm.duala.vernet.messaging.api;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.catalog.CatalogAsset;
import cm.duala.vernet.catalog.CatalogAssetRepository;
import cm.duala.vernet.messaging.Message;
import cm.duala.vernet.messaging.MessageRepository;
import cm.duala.vernet.messaging.MessageThread;
import cm.duala.vernet.messaging.MessageThreadRepository;
import cm.duala.vernet.notifications.NotificationService;
import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.UserRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/messaging")
public class MessagingController {
	private final MessageThreadRepository threads;
	private final MessageRepository messages;
	private final CatalogAssetRepository catalog;
	private final NotificationService notifications;

	public MessagingController(
		MessageThreadRepository threads,
		MessageRepository messages,
		CatalogAssetRepository catalog,
		NotificationService notifications
	) {
		this.threads = threads;
		this.messages = messages;
		this.catalog = catalog;
		this.notifications = notifications;
	}

	@PreAuthorize("hasAnyRole('SUPER_ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@GetMapping("/threads")
	public Map<String, Object> myThreads(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
		AppUser u = SecurityUtil.requireUser();
		var pr = PageRequest.of(Math.max(0, page), Math.min(50, Math.max(1, size)));

		var p = (u.getRole() == UserRole.CLIENT)
			? threads.findByClientOrderByCreatedAtDesc(u, pr)
			: threads.findAll(pr);

		return Map.of(
			"items", p.getContent().stream().map(ThreadDto::from).toList(),
			"page", p.getNumber(),
			"size", p.getSize(),
			"total", p.getTotalElements()
		);
	}

	@PreAuthorize("hasAnyRole('SUPER_ADMIN','SECRETARY','COACH','NUTRITIONIST')")
	@PostMapping("/threads")
	public ResponseEntity<?> createThread(@RequestBody @Valid CreateThreadRequest req) {
		SecurityUtil.requireUser();

		MessageThread t = new MessageThread();
		t.setTitle(req.title());
		t.setCreatedAt(Instant.now());

		// Map IDs (simple / demo-friendly):
		AppUser client = new AppUser();
		client.setId(req.clientId());
		t.setClient(client);

		if (req.coachId() != null) {
			AppUser coach = new AppUser();
			coach.setId(req.coachId());
			t.setCoach(coach);
		}
		if (req.nutritionistId() != null) {
			AppUser nut = new AppUser();
			nut.setId(req.nutritionistId());
			t.setNutritionist(nut);
		}

		t = threads.save(t);

		notifications.notifyInApp(t.getClient(), "MESSAGE", "Nouvelle conversation", "Une conversation a été créée: " + t.getTitle());

		return ResponseEntity.ok(Map.of("id", t.getId()));
	}

	@PreAuthorize("hasAnyRole('SUPER_ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@GetMapping("/threads/{threadId}/messages")
	public ResponseEntity<?> listMessages(@PathVariable Long threadId, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size) {
		AppUser u = SecurityUtil.requireUser();
		MessageThread t = threads.findById(threadId).orElse(null);
		if (t == null) return ResponseEntity.status(404).body(Map.of("error", "NOT_FOUND"));
		if (u.getRole() == UserRole.CLIENT && !t.getClient().getId().equals(u.getId())) {
			return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));
		}

		var p = messages.findByThreadOrderByCreatedAtDesc(t, PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size))));
		return ResponseEntity.ok(Map.of(
			"items", p.getContent().stream().map(MessageDto::from).toList(),
			"page", p.getNumber(),
			"size", p.getSize(),
			"total", p.getTotalElements()
		));
	}

	@PreAuthorize("hasAnyRole('SUPER_ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@PostMapping("/threads/{threadId}/messages")
	public ResponseEntity<?> sendMessage(@PathVariable Long threadId, @RequestBody @Valid SendMessageRequest req) {
		AppUser sender = SecurityUtil.requireUser();
		MessageThread t = threads.findById(threadId).orElse(null);
		if (t == null) return ResponseEntity.status(404).body(Map.of("error", "NOT_FOUND"));
		if (sender.getRole() == UserRole.CLIENT && !t.getClient().getId().equals(sender.getId())) {
			return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));
		}

		CatalogAsset attachment = null;
		if (req.attachmentId() != null) {
			attachment = catalog.findById(req.attachmentId()).orElse(null);
			if (attachment == null) return ResponseEntity.badRequest().body(Map.of("error", "INVALID_ATTACHMENT"));
		}

		Message m = new Message();
		m.setThread(t);
		m.setSender(sender);
		m.setText(req.text());
		m.setAttachment(attachment);
		m.setCreatedAt(Instant.now());
		m = messages.save(m);

		// Notify client if staff sends, notify staff if client sends (simple demo rule)
		if (sender.getRole() == UserRole.CLIENT) {
			notifications.notifyInAppAndEmail(sender, "MESSAGE", "Message envoyé", "Votre message a été envoyé.");
		} else {
			notifications.notifyInAppAndEmail(t.getClient(), "MESSAGE", "Nouveau message", "Vous avez un nouveau message: " + t.getTitle());
		}

		return ResponseEntity.ok(Map.of("id", m.getId()));
	}

	public record CreateThreadRequest(
		@NotNull Long clientId,
		Long coachId,
		Long nutritionistId,
		@NotBlank String title
	) {}

	public record SendMessageRequest(@NotBlank String text, Long attachmentId) {}

	static class ThreadDto {
		public Long id;
		public Long clientId;
		public String title;
		public String createdAt;

		static ThreadDto from(MessageThread t) {
			ThreadDto d = new ThreadDto();
			d.id = t.getId();
			d.clientId = t.getClient() == null ? null : t.getClient().getId();
			d.title = t.getTitle();
			d.createdAt = t.getCreatedAt() == null ? null : t.getCreatedAt().toString();
			return d;
		}
	}

	static class MessageDto {
		public Long id;
		public Long senderId;
		public String text;
		public Long attachmentId;
		public String attachmentName;
		public String createdAt;

		static MessageDto from(Message m) {
			MessageDto d = new MessageDto();
			d.id = m.getId();
			d.senderId = m.getSender() == null ? null : m.getSender().getId();
			d.text = m.getText();
			if (m.getAttachment() != null) {
				d.attachmentId = m.getAttachment().getId();
				d.attachmentName = m.getAttachment().getOriginalFilename();
			}
			d.createdAt = m.getCreatedAt() == null ? null : m.getCreatedAt().toString();
			return d;
		}
	}
}

