package com.habituate.api.insights;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InsightRepository extends JpaRepository<Insight, Long> {
    List<Insight> findByUserIdAndDismissedAtIsNullOrderByGeneratedAtDesc(String userId);

    Optional<Insight> findByUserIdAndTypeAndHabitAIdAndHabitBId(
            String userId, String type, Long habitAId, Long habitBId);
}
