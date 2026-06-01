package cm.duala.vernet.weight;

import cm.duala.vernet.user.AppUser;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
public class WeightEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser client;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private Double weightKg;

    private Double heightCm;
    private Double waistCm;
    private Double hipsCm;
    private Double chestCm;

    @Column(length = 500)
    private String notes;
}
