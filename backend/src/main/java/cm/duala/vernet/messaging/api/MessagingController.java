package cm.duala.vernet.messaging.api;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.catalog.CatalogAsset;
import cm.duala.vernet.catalog.CatalogAssetRepository;
import cm.duala.vernet.catalog.FileStorageService;
import cm.duala.vernet.messaging.Message;
import cm.duala.vernet.messaging.MessageRepository;
import cm.duala.vernet.messaging.MessageThread;
import cm.duala.vernet.messaging.MessageThreadRepository;
import cm.duala.vernet.notifications.NotificationService;
import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import cm.duala.vernet.user.UserRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messaging")
public class MessagingController {

	private final MessageThreadRepository threads;
	private final MessageRepository messages;
	private final CatalogAssetRepository catalog;
	private final FileStorageService storage;
	private final NotificationService notifications;
	private final AppUserRepository users;

	public MessagingController(
		MessageThreadRepository threads,
		MessageRepository messages,
		CatalogAssetRepository catalog,
		FileStorageService storage,
		NotificationService notifications,
		AppUserRepository users
	) {
		this.threads = threads;
		this.messages = messages;
		this.catalog = catalog;
		this.storage = storage;
		this.notifications = notifications;
		this.users = users;
	}

	// ── Staff uniquement (pour les clients) ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@GetMapping("/staff")
	public List<Map<String, Object>> listStaff() {
		return users.findByRoleInOrderByEmailAsc(
			List.of(UserRole.SUPER_ADMIN, UserRole.SECRETARY, UserRole.COACH, UserRole.NUTRITIONIST)
		).stream().map(u -> Map.<String, Object>of(
			"id",    u.getId(),
			"email", u.getEmail(),
			"role",  u.getRole().name()
		)).toList();
	}

	// ── Tous les utilisateurs sauf soi (pour les admins/staff) ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST')")
	@GetMapping("/users")
	public List<Map<String, Object>> listAllUsers() {
		AppUser me = SecurityUtil.requireUser();
		return users.findAll().stream()
			.filter(u -> !u.getId().equals(me.getId()))
			.sorted(Comparator.comparing(u -> u.getRole().name()))
			.map(u -> Map.<String, Object>of(
				"id",    u.getId(),
				"email", u.getEmail(),
				"role",  u.getRole().name()
			)).toList();
	}

	// ── Mes conversations ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@GetMapping("/threads")
	public Map<String, Object> myThreads(
		@RequestParam(defaultValue = "0")  int page,
		@RequestParam(defaultValue = "20") int size
	) {
		AppUser u = SecurityUtil.requireUser();
		var pr = PageRequest.of(Math.max(0, page), Math.min(50, Math.max(1, size)));
		var p = switch (u.getRole()) {
			case CLIENT     -> threads.findByClientOrderByCreatedAtDesc(u, pr);
			case SUPER_ADMIN -> threads.findAll(pr); // Voit tout
			default         -> threads.findByStaffParticipant(u, pr); // Ses propres convs uniquement
		};

		return Map.of(
			"items", p.getContent().stream().map(ThreadDto::from).toList(),
			"page",  p.getNumber(),
			"size",  p.getSize(),
			"total", p.getTotalElements()
		);
	}

	// ── Créer une conversation ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@PostMapping("/threads")
	public ResponseEntity<?> createThread(@RequestBody @Valid CreateThreadRequest req) {
		AppUser sender = SecurityUtil.requireUser();

		MessageThread t = new MessageThread();
		t.setTitle(req.title());
		t.setCreatedAt(Instant.now());

		if (sender.getRole() == UserRole.CLIENT) {
			// Le client s'identifie toujours comme « client » du fil
			t.setClient(users.getReferenceById(sender.getId()));
			if (req.staffId() != null) {
				AppUser target = users.findById(req.staffId()).orElse(null);
				if (target != null) {
					if      (target.getRole() == UserRole.COACH)         t.setCoach(target);
					else if (target.getRole() == UserRole.NUTRITIONIST)  t.setNutritionist(target);
					else                                                  t.setStaff(target); // Admin, Super Admin, Secrétaire
				}
			}
		} else {
			// Staff / Admin
			if (req.clientId() != null) t.setClient(users.getReferenceById(req.clientId()));

			if (req.staffId() != null) {
				AppUser target = users.findById(req.staffId()).orElse(null);
				if (target != null) {
					if      (target.getRole() == UserRole.COACH)         t.setCoach(target);
					else if (target.getRole() == UserRole.NUTRITIONIST)  t.setNutritionist(target);
					else                                                  t.setStaff(target);
				}
			}
			if (req.coachId()        != null) t.setCoach(users.getReferenceById(req.coachId()));
			if (req.nutritionistId() != null) t.setNutritionist(users.getReferenceById(req.nutritionistId()));

			// L'expéditeur staff s'enregistre lui-même s'il n'est pas déjà placé
			if (t.getCoach() == null && t.getNutritionist() == null && t.getStaff() == null
					&& sender.getRole() != UserRole.CLIENT) {
				if      (sender.getRole() == UserRole.COACH)        t.setCoach(sender);
				else if (sender.getRole() == UserRole.NUTRITIONIST) t.setNutritionist(sender);
				else                                                 t.setStaff(sender);
			}
		}

		t = threads.save(t);

		// Notifier le client s'il y en a un et que ce n'est pas lui l'expéditeur
		if (t.getClient() != null && sender.getRole() != UserRole.CLIENT) {
			notifications.notifyInApp(
				t.getClient(), "MESSAGE",
				"Nouvelle conversation", "Une conversation a été créée : " + t.getTitle()
			);
		}

		return ResponseEntity.ok(Map.of("id", t.getId(), "title", t.getTitle()));
	}

	// ── Messages d'un fil ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@GetMapping("/threads/{threadId}/messages")
	public ResponseEntity<?> listMessages(
		@PathVariable Long threadId,
		@RequestParam(defaultValue = "0")  int page,
		@RequestParam(defaultValue = "30") int size
	) {
		AppUser u = SecurityUtil.requireUser();
		MessageThread t = threads.findById(threadId).orElse(null);
		if (t == null) return ResponseEntity.status(404).body(Map.of("error", "NOT_FOUND"));
		// CLIENT ne peut voir que ses propres fils
		if (u.getRole() == UserRole.CLIENT
			&& (t.getClient() == null || !t.getClient().getId().equals(u.getId()))) {
			return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));
		}
		var p = messages.findByThreadOrderByCreatedAtDesc(
			t, PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)))
		);
		return ResponseEntity.ok(Map.of(
			"items", p.getContent().stream().map(MessageDto::from).toList(),
			"page",  p.getNumber(),
			"size",  p.getSize(),
			"total", p.getTotalElements()
		));
	}

	// ── Envoyer un message ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@PostMapping("/threads/{threadId}/messages")
	public ResponseEntity<?> sendMessage(
		@PathVariable Long threadId,
		@RequestBody @Valid SendMessageRequest req
	) {
		AppUser sender = SecurityUtil.requireUser();
		MessageThread t = threads.findById(threadId).orElse(null);
		if (t == null) return ResponseEntity.status(404).body(Map.of("error", "NOT_FOUND"));
		// CLIENT ne peut écrire que dans ses propres fils
		if (sender.getRole() == UserRole.CLIENT
			&& (t.getClient() == null || !t.getClient().getId().equals(sender.getId()))) {
			return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));
		}

		CatalogAsset attachment = null;
		if (req.attachmentId() != null) {
			attachment = catalog.findById(req.attachmentId()).orElse(null);
			if (attachment == null)
				return ResponseEntity.badRequest().body(Map.of("error", "INVALID_ATTACHMENT"));
		}

		Message m = new Message();
		m.setThread(t);
		m.setSender(sender);
		m.setText(req.text());
		m.setAttachment(attachment);
		m.setCreatedAt(Instant.now());
		m = messages.save(m);

		// Notifications
		if (sender.getRole() == UserRole.CLIENT) {
			notifications.notifyInAppAndEmail(sender, "MESSAGE", "Message envoyé", "Votre message a été envoyé.");
		} else if (t.getClient() != null) {
			notifications.notifyInAppAndEmail(
				t.getClient(), "MESSAGE",
				"Nouveau message", "Vous avez un nouveau message : " + t.getTitle()
			);
		}

		return ResponseEntity.ok(Map.of("id", m.getId()));
	}

	// ── Envoyer un fichier/image dans un message ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@PostMapping(value = "/threads/{threadId}/messages/upload", consumes = "multipart/form-data")
	public ResponseEntity<?> sendFile(
		@PathVariable Long threadId,
		@RequestParam("file") org.springframework.web.multipart.MultipartFile file,
		@RequestParam(value = "text", required = false) String text
	) throws java.io.IOException {
		AppUser sender = SecurityUtil.requireUser();
		MessageThread t = threads.findById(threadId).orElse(null);
		if (t == null) return ResponseEntity.status(404).body(Map.of("error", "NOT_FOUND"));
		if (sender.getRole() == UserRole.CLIENT
			&& (t.getClient() == null || !t.getClient().getId().equals(sender.getId())))
			return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));
		if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "EMPTY_FILE"));

		// Sauvegarder le fichier
		storage.ensureBaseDir();
		String key = storage.newStorageKey();
		java.nio.file.Files.copy(file.getInputStream(), storage.pathFor(key));

		CatalogAsset asset = new CatalogAsset();
		asset.setUploadedBy(sender);
		asset.setOriginalFilename(file.getOriginalFilename() != null ? file.getOriginalFilename() : "fichier");
		asset.setContentType(file.getContentType() != null ? file.getContentType() : "application/octet-stream");
		asset.setSizeBytes(file.getSize());
		asset.setStorageKey(key);
		catalog.save(asset);

		Message m = new Message();
		m.setThread(t);
		m.setSender(sender);
		m.setText(text != null && !text.isBlank() ? text.trim() : "");
		m.setAttachment(asset);
		m.setCreatedAt(Instant.now());
		messages.save(m);

		// Notifier le client si besoin
		if (t.getClient() != null && sender.getRole() != UserRole.CLIENT) {
			notifications.notifyInApp(t.getClient(), "MESSAGE", "Nouveau fichier",
				sender.getEmail().split("@")[0] + " vous a envoyé un fichier.");
		}

		return ResponseEntity.ok(MessageDto.from(m));
	}

	// ── Vider toute la messagerie (Super Admin — dev uniquement) ──
	@PreAuthorize("hasRole('SUPER_ADMIN')")
	@Transactional
	@DeleteMapping("/clear-all")
	public ResponseEntity<?> clearAll() {
		messages.deleteAll();
		threads.deleteAll();
		return ResponseEntity.ok(Map.of("cleared", true));
	}

	// ── Supprimer une conversation (et tous ses messages) ──
	@Transactional
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@DeleteMapping("/threads/{threadId}")
	public ResponseEntity<?> deleteThread(@PathVariable Long threadId) {
		AppUser user = SecurityUtil.requireUser();
		MessageThread t = threads.findById(threadId).orElse(null);
		if (t == null) return ResponseEntity.notFound().build();
		// CLIENT ne peut supprimer que ses propres conversations
		if (user.getRole() == UserRole.CLIENT
			&& (t.getClient() == null || !t.getClient().getId().equals(user.getId()))) {
			return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));
		}
		messages.deleteByThread(t);
		threads.deleteById(threadId);
		return ResponseEntity.ok(Map.of("deleted", true));
	}

	// ── Modifier un message ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@PutMapping("/threads/{threadId}/messages/{msgId}")
	public ResponseEntity<?> editMessage(
		@PathVariable Long threadId,
		@PathVariable Long msgId,
		@RequestBody @Valid EditMessageRequest req
	) {
		AppUser sender = SecurityUtil.requireUser();
		Message m = messages.findById(msgId).orElse(null);
		if (m == null) return ResponseEntity.notFound().build();
		if (!m.getSender().getId().equals(sender.getId()))
			return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));
		if (req.text() != null && !req.text().isBlank()) {
			m.setText(req.text().trim());
			m.setEditedAt(Instant.now());
		}
		return ResponseEntity.ok(MessageDto.from(messages.save(m)));
	}

	// ── Supprimer un message ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@DeleteMapping("/threads/{threadId}/messages/{msgId}")
	public ResponseEntity<?> deleteMessage(
		@PathVariable Long threadId,
		@PathVariable Long msgId
	) {
		AppUser sender = SecurityUtil.requireUser();
		Message m = messages.findById(msgId).orElse(null);
		if (m == null) return ResponseEntity.notFound().build();
		if (!m.getSender().getId().equals(sender.getId()))
			return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));
		messages.deleteById(msgId);
		return ResponseEntity.ok(Map.of("deleted", true));
	}

	// ── Records & DTOs ──

	public record EditMessageRequest(@NotBlank String text) {}

	public record CreateThreadRequest(
		Long clientId,
		Long staffId,
		Long coachId,
		Long nutritionistId,
		@NotBlank String title
	) {}

	public record SendMessageRequest(@NotBlank String text, Long attachmentId) {}

	static class ThreadDto {
		public Long   id;
		public Long   clientId;       public String clientEmail;
		public Long   coachId;        public String coachEmail;
		public Long   nutritionistId; public String nutritionistEmail;
		public Long   staffId;        public String staffEmail;
		public String title;
		public String createdAt;

		static ThreadDto from(MessageThread t) {
			var d = new ThreadDto();
			d.id = t.getId();
			if (t.getClient()       != null) { d.clientId = t.getClient().getId();             d.clientEmail = t.getClient().getEmail(); }
			if (t.getCoach()        != null) { d.coachId  = t.getCoach().getId();              d.coachEmail  = t.getCoach().getEmail(); }
			if (t.getNutritionist() != null) { d.nutritionistId = t.getNutritionist().getId(); d.nutritionistEmail = t.getNutritionist().getEmail(); }
			if (t.getStaff()        != null) { d.staffId  = t.getStaff().getId();              d.staffEmail  = t.getStaff().getEmail(); }
			d.title     = t.getTitle();
			d.createdAt = t.getCreatedAt() == null ? null : t.getCreatedAt().toString();
			return d;
		}
	}

	// ── Marquer les messages d'un fil comme lus ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@PostMapping("/threads/{threadId}/read")
	public ResponseEntity<?> markRead(@PathVariable Long threadId) {
		AppUser reader = SecurityUtil.requireUser();
		MessageThread t = threads.findById(threadId).orElse(null);
		if (t == null) return ResponseEntity.notFound().build();
		messages.findByThreadOrderByCreatedAtDesc(t, org.springframework.data.domain.PageRequest.of(0, 200))
			.getContent().forEach(m -> {
				if (m.getSender() != null && !m.getSender().getId().equals(reader.getId()) && m.getReadAt() == null) {
					m.setReadAt(Instant.now());
					messages.save(m);
				}
			});
		return ResponseEntity.ok(Map.of("ok", true));
	}

	static class MessageDto {
		public Long    id;
		public Long    senderId;
		public String  senderEmail;
		public String  text;
		public Long    attachmentId;
		public String  attachmentName;
		public String  attachmentContentType;
		public long    attachmentSize;
		public String  createdAt;
		public String  editedAt;
		public boolean read;

		static MessageDto from(Message m) {
			var d = new MessageDto();
			d.id          = m.getId();
			d.senderId    = m.getSender() == null ? null : m.getSender().getId();
			d.senderEmail = m.getSender() == null ? null : m.getSender().getEmail();
			d.text        = m.getText();
			if (m.getAttachment() != null) {
				d.attachmentId          = m.getAttachment().getId();
				d.attachmentName        = m.getAttachment().getOriginalFilename();
				d.attachmentContentType = m.getAttachment().getContentType();
				d.attachmentSize        = m.getAttachment().getSizeBytes();
			}
			d.createdAt = m.getCreatedAt() == null ? null : m.getCreatedAt().toString();
			d.editedAt  = m.getEditedAt()  == null ? null : m.getEditedAt().toString();
			d.read      = m.getReadAt() != null;
			return d;
		}
	}
}
