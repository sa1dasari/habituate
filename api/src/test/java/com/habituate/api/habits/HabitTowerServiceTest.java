package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** HabitTowerService's segment lifecycle — lazy backfill of the first open
 * segment, and top-out closing one segment while opening the next. */
@SpringBootTest
class HabitTowerServiceTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private HabitTowerService habitTowerService;

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private CheckInRepository checkInRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private String userId;
    private Long habitId;

    @AfterEach
    void cleanup() {
        if (habitId != null) {
            habitService.deleteHabit(userId, habitId);
        }
    }

    private Habit createDailyHabit(String uid) {
        userId = uid;
        HabitResponse response = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Tower Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null));
        habitId = response.id();
        return habitRepository.findById(habitId).orElseThrow();
    }

    /** Backdates the habit's own createdAt so the segment lazily backfilled
     * from it (started_at = habit.createdAt) is old enough to contain
     * check-ins the test inserts "days ago" — a freshly-created habit's
     * open segment otherwise starts at "now", which would filter those
     * check-ins out of the segment's own window before StreakCalculator
     * ever sees them. Uses an explicit TransactionTemplate rather than a
     * plain @Transactional test method, since this test class instance
     * isn't itself a Spring-proxied bean — a self-invoked @Transactional
     * method here would silently run with no transaction at all (same
     * self-invocation gotcha HabitService.createCheckIn's own comment
     * documents for production code).
     */
    private Habit backdateHabitCreation(Long id, int daysAgo) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            entityManager.createNativeQuery("UPDATE habits SET created_at = ?1 WHERE id = ?2")
                    .setParameter(1, Instant.now().minus(daysAgo, ChronoUnit.DAYS))
                    .setParameter(2, id)
                    .executeUpdate();
        });
        entityManager.clear();
        return habitRepository.findById(id).orElseThrow();
    }

    @Test
    void currentSegment_lazilyBackfillsOneOpenSegmentStartingAtHabitCreation() {
        Habit habit = createDailyHabit("tower-test-user-1");

        HabitTower segment = habitTowerService.currentSegment(habit);

        assertThat(segment.getToppedOutAt()).isNull();
        assertThat(segment.getStartedAt()).isEqualTo(habit.getCreatedAt());
    }

    @Test
    void currentSegment_isIdempotent_doesNotCreateASecondOpenSegment() {
        Habit habit = createDailyHabit("tower-test-user-2");

        HabitTower first = habitTowerService.currentSegment(habit);
        HabitTower second = habitTowerService.currentSegment(habit);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(habitTowerService.listSegments(habitId)).hasSize(1);
    }

    @Test
    void topOut_closesCurrentSegmentAndOpensANewOneWithoutTouchingCheckIns() {
        Habit habit = backdateHabitCreation(createDailyHabit("tower-test-user-3").getId(), 10);
        for (int i = 0; i < 5; i++) {
            checkInRepository.save(new CheckIn(habitId, userId, Instant.now().minus(i, ChronoUnit.DAYS), 1, "manual"));
        }

        HabitTower closed = habitTowerService.topOut(habit, ZoneOffset.UTC);

        var segments = habitTowerService.listSegments(habitId);
        assertThat(segments).hasSize(2);
        assertThat(segments.get(0).getToppedOutAt()).isNotNull();
        assertThat(segments.get(0).getBestRunInSegment()).isEqualTo(5);
        assertThat(segments.get(1).getId()).isEqualTo(closed.getId());
        assertThat(segments.get(1).getToppedOutAt()).isNull();
        // the run itself is untouched — still 5 real check-ins on the habit
        assertThat(checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtAsc(userId, habitId)).hasSize(5);
    }

    @Test
    void topOut_bestRunInSegmentOnlyCountsCheckInsWithinThatSegmentsWindow() {
        Habit habit = backdateHabitCreation(createDailyHabit("tower-test-user-4").getId(), 10);
        checkInRepository.save(new CheckIn(habitId, userId, Instant.now().minus(2, ChronoUnit.DAYS), 1, "manual"));
        checkInRepository.save(new CheckIn(habitId, userId, Instant.now().minus(1, ChronoUnit.DAYS), 1, "manual"));

        // Closes the first segment (best run 2, from the two check-ins above)
        // and opens a new one starting now.
        habitTowerService.topOut(habit, ZoneOffset.UTC);

        // Lands in the new segment's window only.
        checkInRepository.save(new CheckIn(habitId, userId, Instant.now(), 1, "manual"));

        // topOut returns the freshly-opened segment, not the one it just
        // closed — after this second call there are 3 segments total:
        // [closed #1, closed #2, open #3].
        HabitTower thirdOpen = habitTowerService.topOut(habit, ZoneOffset.UTC);
        var segments = habitTowerService.listSegments(habitId);

        assertThat(segments).hasSize(3);
        assertThat(segments.get(0).getBestRunInSegment()).isEqualTo(2);
        // only today's check-in fell inside segment #2's own window before it closed
        assertThat(segments.get(1).getBestRunInSegment()).isEqualTo(1);
        assertThat(segments.get(2).getId()).isEqualTo(thirdOpen.getId());
        assertThat(segments.get(2).getToppedOutAt()).isNull();
    }
}
