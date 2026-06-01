package cm.duala.vernet.program;

import cm.duala.vernet.user.AppUser;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Getter @Setter
@Entity
@Table(name = "client_program")
public class ClientProgram {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser client;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser staff;

    /** Durée choisie par l'employé : 6, 7 ou 8 semaines */
    @Column(nullable = false)
    private int durationWeeks = 6;

    private LocalDate startDate;

    /** ACTIVE, COMPLETED, PAUSED */
    @Column(length = 20, nullable = false)
    private String status = "ACTIVE";

    private Instant createdAt = Instant.now();
}
