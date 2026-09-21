package com.habituate.api.goals;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GoalRepository extends JpaRepository<Goal, Long> {
    List<Goal> findByUserIdAndArchivedFalseOrderByCreatedAtDesc(String userId);

    List<Goal> findByUserIdAndArchivedTrueOrderByUpdatedAtDesc(String userId);
}
