package cm.duala.vernet.catalog.api;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.catalog.CatalogAsset;
import cm.duala.vernet.catalog.CatalogAssetRepository;
import cm.duala.vernet.messaging.MessageRepository;
import cm.duala.vernet.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/client-catalog")
public class ClientCatalogController {

    private final CatalogAssetRepository repo;
    private final MessageRepository      messages;

    public ClientCatalogController(CatalogAssetRepository repo, MessageRepository messages) {
        this.repo     = repo;
        this.messages = messages;
    }

    // ── Sauvegarder un fichier reçu dans son catalogue personnel ──────────────
    @PreAuthorize("hasRole('CLIENT')")
    @PostMapping("/save/{assetId}")
    public ResponseEntity<?> save(@PathVariable Long assetId) {
        AppUser client = SecurityUtil.requireUser();
        CatalogAsset asset = repo.findById(assetId).orElse(null);
        if (asset == null) return ResponseEntity.notFound().build();

        // Vérifier que le client a accès à ce fichier (via messagerie)
        boolean viaMessage = messages.findFirstByAttachment_Id(assetId)
            .map(m -> m.getThread().getClient() != null
                && m.getThread().getClient().getId().equals(client.getId()))
            .orElse(false);

        boolean alreadyShared = asset.getSharedWithClient() != null
            && asset.getSharedWithClient().getId().equals(client.getId());

        if (!viaMessage && !alreadyShared)
            return ResponseEntity.status(403).body(Map.of("error", "FORBIDDEN"));

        asset.setSharedWithClient(client);
        repo.save(asset);
        return ResponseEntity.ok(Map.of("saved", true));
    }
}
