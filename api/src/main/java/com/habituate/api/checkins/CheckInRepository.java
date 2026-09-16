package com.habituate.api.checkins;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CheckInRepository extends JpaRepository<CheckIn, Long> {
    List<CheckIn> findByUserIdAndHabitIdOrderByOccurredAtDesc(String userId, Long habitId);

    List<CheckIn> findByUserIdAndHabitIdOrderByOccurredAtAsc(String userId, Long habitId);

    void deleteByHabitId(Long habitId);
}
