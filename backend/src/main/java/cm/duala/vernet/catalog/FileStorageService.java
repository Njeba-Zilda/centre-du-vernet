package cm.duala.vernet.catalog;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;

@Service
public class FileStorageService {
	private final Path baseDir;
	private final SecureRandom random = new SecureRandom();

	public FileStorageService(@Value("${app.storage.dir:storage}") String baseDir) {
		this.baseDir = Path.of(baseDir).toAbsolutePath().normalize();
	}

	public Path ensureBaseDir() throws IOException {
		Files.createDirectories(baseDir);
		return baseDir;
	}

	public String newStorageKey() {
		byte[] buf = new byte[18];
		random.nextBytes(buf);
		StringBuilder sb = new StringBuilder();
		for (byte b : buf) sb.append(String.format("%02x", b));
		return sb.toString();
	}

	public Path pathFor(String storageKey) {
		return baseDir.resolve(storageKey).normalize();
	}
}

