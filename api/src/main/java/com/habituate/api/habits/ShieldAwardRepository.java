package com.habituate.api.habits;

public interface ShieldAwardRepository extends org.springframework.data.jpa.repository.JpaRepository<ShieldAward, Long> {
    boolean existsByUserIdAndHabitIdAndStreakLength(String userId, Long habitId, Integer streakLength);

    long countByUserId(String userId);

    void deleteByHabitId(Long habitId);

    void deleteByUserId(String userId);
}
