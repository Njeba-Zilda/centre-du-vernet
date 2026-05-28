package cm.duala.vernet.catalog.api;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.catalog.CatalogAsset;
import cm.duala.vernet.catalog.CatalogAssetRepository;
import cm.duala.vernet.catalog.FileStorageService;
import cm.duala.vernet.user.AppUser;
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
import java.util.Map;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {
	private final CatalogAssetRepository repo;
	private final FileStorageService storage;

	public CatalogController(CatalogAssetRepository repo, FileStorageService storage) {
		this.repo = repo;
		this.storage = storage;
	}

	@PreAuthorize("hasAnyRole('SUPER_ADMIN','SECRETARY','COACH','NUTRITIONIST')")
	@PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<?> upload(@RequestPart("file") MultipartFile file) throws IOException {
		AppUser uploader = SecurityUtil.requireUser();
		if (uploader.getRole() == UserRole.CLIENT) {
			return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));
		}
		if (file.isEmpty() || file.getOriginalFilename() == null) {
			return ResponseEntity.badRequest().body(Map.of("error", "EMPTY_FILE"));
		}

		storage.ensureBaseDir();
		String key = storage.newStorageKey();
		var path = storage.pathFor(key);
		Files.copy(file.getInputStream(), path);

		CatalogAsset a = new CatalogAsset();
		a.setUploadedBy(uploader);
		a.setOriginalFilename(file.getOriginalFilename());
		a.setContentType(file.getContentType() == null ? "application/octet-stream" : file.getContentType());
		a.setSizeBytes(file.getSize());
		a.setStorageKey(key);
		a.setCreatedAt(Instant.now());
		repo.save(a);

		return ResponseEntity.ok(Map.of("id", a.getId()));
	}

	@GetMapping
	public Map<String, Object> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
		var p = repo.findAllByOrderByCreatedAtDesc(PageRequest.of(Math.max(0, page), Math.min(50, Math.max(1, size))));
		return Map.of(
			"items", p.getContent().stream().map(CatalogDto::from).toList(),
			"page", p.getNumber(),
			"size", p.getSize(),
			"total", p.getTotalElements()
		);
	}

	@GetMapping("/{id}/download")
	public ResponseEntity<Resource> download(@PathVariable Long id) throws IOException {
		CatalogAsset a = repo.findById(id).orElse(null);
		if (a == null) return ResponseEntity.notFound().build();

		var path = storage.pathFor(a.getStorageKey());
		if (!Files.exists(path)) return ResponseEntity.notFound().build();

		Resource resource = new FileSystemResource(path);
		return ResponseEntity.ok()
			.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + a.getOriginalFilename().replace("\"", "") + "\"")
			.contentType(MediaType.parseMediaType(a.getContentType()))
			.contentLength(a.getSizeBytes())
			.body(resource);
	}

	static class CatalogDto {
		public Long id;
		public String originalFilename;
		public String contentType;
		public long sizeBytes;
		public String createdAt;

		static CatalogDto from(CatalogAsset a) {
			CatalogDto d = new CatalogDto();
			d.id = a.getId();
			d.originalFilename = a.getOriginalFilename();
			d.contentType = a.getContentType();
			d.sizeBytes = a.getSizeBytes();
			d.createdAt = a.getCreatedAt() == null ? null : a.getCreatedAt().toString();
			return d;
		}
	}
}

