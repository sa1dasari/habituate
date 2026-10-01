package com.habituate.api.insights;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CorrelationRepository extends JpaRepository<Correlation, Long> {
    Optional<Correlation> findByUserIdAndHabitAIdAndHabitBIdAndWindowDays(
            String userId, Long habitAId, Long habitBId, Integer windowDays);
}
