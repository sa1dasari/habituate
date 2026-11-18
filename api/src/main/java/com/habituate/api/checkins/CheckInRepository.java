package com.habituate.api.checkins;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface CheckInRepository extends JpaRepository<CheckIn, Long> {
    List<CheckIn> findByUserIdAndHabitIdOrderByOccurredAtDesc(String userId, Long habitId);

    List<CheckIn> findByUserIdAndHabitIdOrderByOccurredAtAsc(String userId, Long habitId);

    void deleteByHabitId(Long habitId);

    List<CheckIn> findByUserId(String userId);

    void deleteByUserId(String userId);

    boolean existsByHabitIdAndOccurredAtBetween(Long habitId, Instant start, Instant end);

    /** A WEEKLY/MONTHLY group member's period qualification: raw check-in event count
     * (not summed COUNT-habit values) against their habit's weekly/monthlyTarget — same
     * "log-event count, not the value" rule the personal lots view already follows. */
    long countByHabitIdAndOccurredAtBetween(Long habitId, Instant start, Instant end);

    /** Who's actually been active — the nightly insights job only bothers with these users. */
    @Query("select distinct c.userId from CheckIn c where c.occurredAt >= :since")
    List<String> findDistinctUserIdsSince(Instant since);

    /** Friend-activity feed: recent check-ins from co-members across the viewer's own shared-habit groups, excluding their own. */
    List<CheckIn> findTop20ByGroupIdInAndUserIdNotOrderByOccurredAtDesc(List<Long> groupIds, String userId);
}
