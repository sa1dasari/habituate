package com.habituate.api.habits;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HabitTowerRepository extends JpaRepository<HabitTower, Long> {
    List<HabitTower> findByHabitIdOrderByStartedAtAsc(Long habitId);

    Optional<HabitTower> findByHabitIdAndToppedOutAtIsNull(Long habitId);

    /** Board 58's combined list: every closed segment across a set of (the caller's own, non-archived) habit ids. */
    List<HabitTower> findByHabitIdInAndToppedOutAtIsNotNullOrderByToppedOutAtDesc(List<Long> habitIds);

    void deleteByHabitId(Long habitId);
}
