package cm.duala.vernet.program;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WeeklyPlanRepository extends JpaRepository<WeeklyPlan, Long> {
    List<WeeklyPlan> findByProgramOrderByWeekNumberAsc(ClientProgram program);
    Optional<WeeklyPlan> findByProgramAndWeekNumber(ClientProgram program, int weekNumber);
}
