package com.habituate.api.habits;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HabitRepository extends JpaRepository<Habit, Long> {
    List<Habit> findByUserIdAndArchivedFalseOrderByCreatedAtDesc(String userId);

    List<Habit> findByUserIdAndArchivedTrueOrderByUpdatedAtDesc(String userId);

    List<Habit> findByUserIdOrderByCreatedAtDesc(String userId);
}
