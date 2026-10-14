package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StreakFreezeRepository extends JpaRepository<StreakFreeze, Long> {
    List<StreakFreeze> findByGroupIdAndUsedOnDateAfter(Long groupId, LocalDate after);

    void deleteByGroupId(Long groupId);

    List<StreakFreeze> findByHabitId(Long habitId);

    void deleteByHabitId(Long habitId);

    /** Scoped to personal (non-group) rows naturally — group freezes never set userId. */
    void deleteByUserId(String userId);

    Optional<StreakFreeze> findByHabitIdAndUsedOnDate(Long habitId, LocalDate usedOnDate);

    long countByUserIdAndHabitIdIsNotNull(String userId);
}
