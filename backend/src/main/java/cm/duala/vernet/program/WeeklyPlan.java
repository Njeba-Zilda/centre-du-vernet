package cm.duala.vernet.program;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter @Setter
@Entity
@Table(name = "weekly_plan")
public class WeeklyPlan {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private ClientProgram program;

    @Column(nullable = false)
    private int weekNumber; // 1 à 8

    @Column(length = 3000)
    private String objectives; // objectifs de la semaine

    @Column(length = 3000)
    private String plan; // actions concrètes prévues

    @Column(length = 1500)
    private String results; // résultats observés en fin de semaine

    @Column(length = 1000)
    private String notes;

    private boolean completed = false;

    private Instant updatedAt;
}
