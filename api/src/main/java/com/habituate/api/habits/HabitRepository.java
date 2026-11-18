package com.habituate.api.habits;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface HabitRepository extends JpaRepository<Habit, Long> {
    List<Habit> findByUserIdAndArchivedFalseOrderByCreatedAtDesc(String userId);

    List<Habit> findByUserIdAndArchivedTrueOrderByUpdatedAtDesc(String userId);

    List<Habit> findByUserIdOrderByCreatedAtDesc(String userId);

    List<Habit> findByReminderEnabledTrueAndArchivedFalseAndScheduledTimeIsNotNull();

    /** One-time, idempotent: caps above the new maximum become the maximum. */
    @Modifying
    @Query("update Habit h set h.topOutThresholdDays = :max where h.topOutThresholdDays > :max")
    int clampTopOutThresholds(@Param("max") int max);

    void deleteByUserId(String userId);
}
