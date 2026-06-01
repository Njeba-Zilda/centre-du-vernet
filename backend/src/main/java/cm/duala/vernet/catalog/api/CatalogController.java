package cm.duala.vernet.catalog.api;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.catalog.CatalogAsset;
import cm.duala.vernet.catalog.CatalogAssetRepository;
import cm.duala.vernet.catalog.FileStorageService;
import cm.duala.vernet.messaging.MessageRepository;
import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import cm.duala.vernet.user.UserRole;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {
	private final CatalogAssetRepository repo;
	private final FileStorageService     storage;
	private final AppUserRepository      users;
	private final MessageRepository      messages;

	public CatalogController(CatalogAssetRepository repo, FileStorageService storage,
	                         AppUserRepository users, MessageRepository messages) {
		this.repo     = repo;
		this.storage  = storage;
		this.users    = users;
		this.messages = messages;
	}

	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST')")
	@PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<?> upload(
		@RequestPart("file") MultipartFile file,
		@RequestPart(name = "category", required = false) String category
	) throws IOException {
		AppUser uploader = SecurityUtil.requireUser();
		if (file.isEmpty() || file.getOriginalFilename() == null)
			return ResponseEntity.badRequest().body(Map.of("error", "EMPTY_FILE"));

		storage.ensureBaseDir();
		String key = storage.newStorageKey();
		Files.copy(file.getInputStream(), storage.pathFor(key));

		CatalogAsset a = new CatalogAsset();
		a.setUploadedBy(uploader);
		a.setOriginalFilename(file.getOriginalFilename());
		a.setContentType(file.getContentType() != null ? file.getContentType() : "application/octet-stream");
		a.setSizeBytes(file.getSize());
		a.setStorageKey(key);
		a.setCategory(category != null && !category.isBlank() ? category.trim() : null);
		a.setCreatedAt(Instant.now());
		repo.save(a);

		return ResponseEntity.ok(Map.of("id", a.getId()));
	}

	// ── Partager un fichier du catalogue avec un client ──
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST')")
	@PostMapping("/{id}/share/{clientId}")
	public ResponseEntity<?> share(@PathVariable Long id, @PathVariable Long clientId) {
		CatalogAsset a = repo.findById(id).orElse(null);
		if (a == null) return ResponseEntity.notFound().build();
		AppUser client = users.findById(clientId).orElse(null);
		if (client == null) return ResponseEntity.notFound().build();
		a.setSharedWithClient(client);
		return ResponseEntity.ok(CatalogDto.from(repo.save(a)));
	}

	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@GetMapping
	public Map<String, Object> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
		AppUser u = SecurityUtil.requireUser();
		List<CatalogDto> items;
		if (u.getRole() == UserRole.CLIENT) {
			// Client : uniquement les fichiers partagés avec lui
			items = repo.findBySharedWithClientOrderByCreatedAtDesc(u).stream().map(CatalogDto::from).toList();
		} else {
			// Staff/Admin : tous les fichiers
			items = repo.findAllByOrderByCreatedAtDesc(PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size))))
				.getContent().stream().map(CatalogDto::from).toList();
		}
		return Map.of("items", items, "total", items.size());
	}

	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST')")
	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) throws IOException {
		CatalogAsset a = repo.findById(id).orElse(null);
		if (a == null) return ResponseEntity.notFound().build();
		var path = storage.pathFor(a.getStorageKey());
		Files.deleteIfExists(path);
		repo.deleteById(id);
		return ResponseEntity.ok(Map.of("deleted", true));
	}

	@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST','CLIENT')")
	@GetMapping("/{id}/download")
	public ResponseEntity<Resource> download(@PathVariable Long id) throws IOException {
		AppUser u = SecurityUtil.requireUser();
		CatalogAsset a = repo.findById(id).orElse(null);
		if (a == null) return ResponseEntity.notFound().build();

		// Client : autorisé si le fichier lui est partagé directement
		// OU si ce fichier est une pièce jointe d'un message dans une de ses conversations
		if (u.getRole() == UserRole.CLIENT) {
			boolean sharedDirect = a.getSharedWithClient() != null
				&& a.getSharedWithClient().getId().equals(u.getId());

			boolean sharedViaMessage = false;
			if (!sharedDirect) {
				var msg = messages.findFirstByAttachment_Id(a.getId());
				if (msg.isPresent()) {
					var thread = msg.get().getThread();
					sharedViaMessage = thread.getClient() != null
						&& thread.getClient().getId().equals(u.getId());
				}
			}

			if (!sharedDirect && !sharedViaMessage)
				return ResponseEntity.status(403).build();
		}

		var path = storage.pathFor(a.getStorageKey());
		if (!Files.exists(path)) return ResponseEntity.notFound().build();

		return ResponseEntity.ok()
			.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + a.getOriginalFilename().replace("\"", "") + "\"")
			.contentType(MediaType.parseMediaType(a.getContentType()))
			.contentLength(a.getSizeBytes())
			.body(new FileSystemResource(path));
	}

	static class CatalogDto {
		public Long   id;
		public String originalFilename;
		public String contentType;
		public long   sizeBytes;
		public String category;
		public Long   sharedWithClientId;
		public String createdAt;

		static CatalogDto from(CatalogAsset a) {
			CatalogDto d = new CatalogDto();
			d.id                 = a.getId();
			d.originalFilename   = a.getOriginalFilename();
			d.contentType        = a.getContentType();
			d.sizeBytes          = a.getSizeBytes();
			d.category           = a.getCategory();
			d.sharedWithClientId = a.getSharedWithClient() != null ? a.getSharedWithClient().getId() : null;
			d.createdAt          = a.getCreatedAt() != null ? a.getCreatedAt().toString() : null;
			return d;
		}
	}
}
