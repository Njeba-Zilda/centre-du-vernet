package cm.duala.vernet.audit;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter @Setter
@Entity
@Table(name = "activity_log")
public class ActivityLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String action;  // LOGIN, USER_CREATED, USER_DELETED, ROLE_CHANGED, etc.

    @Column(length = 120)
    private String performedBy; // email de l'acteur

    @Column(length = 120)
    private String targetUser;  // email de la cible (si applicable)

    @Column(length = 300)
    private String details;

    private Instant createdAt = Instant.now();
}
