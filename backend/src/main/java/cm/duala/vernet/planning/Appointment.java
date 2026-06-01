package cm.duala.vernet.planning;

import cm.duala.vernet.user.AppUser;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
public class Appointment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser client;

    @ManyToOne(fetch = FetchType.LAZY)
    private AppUser staff;

    @Column(nullable = false)
    private LocalDateTime scheduledAt;

    @Column(length = 60)
    private String type = "CONSULTATION";

    @Column(length = 500)
    private String notes;

    @Column(length = 20)
    private String status = "PENDING";

    private Instant createdAt = Instant.now();
}
