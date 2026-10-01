package com.habituate.api.checkins;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface CheckInRepository extends JpaRepository<CheckIn, Long> {
    List<CheckIn> findByUserIdAndHabitIdOrderByOccurredAtDesc(String userId, Long habitId);

    List<CheckIn> findByUserIdAndHabitIdOrderByOccurredAtAsc(String userId, Long habitId);

    void deleteByHabitId(Long habitId);

    boolean existsByHabitIdAndOccurredAtBetween(Long habitId, Instant start, Instant end);

    /** Who's actually been active — the nightly insights job only bothers with these users. */
    @Query("select distinct c.userId from CheckIn c where c.occurredAt >= :since")
    List<String> findDistinctUserIdsSince(Instant since);
}
