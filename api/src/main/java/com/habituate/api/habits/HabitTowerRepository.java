package com.habituate.api.habits;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HabitTowerRepository extends JpaRepository<HabitTower, Long> {
    List<HabitTower> findByHabitIdOrderByStartedAtAsc(Long habitId);

    Optional<HabitTower> findByHabitIdAndToppedOutAtIsNull(Long habitId);

    void deleteByHabitId(Long habitId);
}
