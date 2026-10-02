package com.habituate.api.insights;

import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.events.CheckInEventPublisher;
import com.habituate.api.habits.CreateHabitRequest;
import com.habituate.api.habits.HabitResponse;
import com.habituate.api.habits.HabitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class InsightServiceTest {

    @Autowired
    private InsightService insightService;

    @Autowired
    private HabitService habitService;

    @Autowired
    private CorrelationRepository correlationRepository;

    @Autowired
    private InsightRepository insightRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockBean
    private CheckInEventPublisher checkInEventPublisher;

    private final List<Long> habitIds = new ArrayList<>();
    private String userId;

    @AfterEach
    void cleanup() {
        // Correlation/Insight rows aren't cascade-deleted with their habits
        // (they're derived cache data, not source of truth, and habits.
        // HabitService intentionally doesn't depend on the insights package)
        // — clean them up directly here so repeated test runs don't leave
        // stale rows (or, worse, a stale dismissal) behind in the dev DB.
        for (Long habitId : habitIds) {
            correlationRepository.findAll().stream()
                    .filter(c -> habitId.equals(c.getHabitAId()) || habitId.equals(c.getHabitBId()))
                    .forEach(correlationRepository::delete);
            insightRepository.findAll().stream()
                    .filter(i -> habitId.equals(i.getHabitAId()) || habitId.equals(i.getHabitBId()))
                    .forEach(insightRepository::delete);
        }
        for (Long habitId : habitIds) {
            habitService.deleteHabit(userId, habitId);
        }
        habitIds.clear();
    }

    private Long createHabit(String name) {
        HabitResponse response = habitService.createHabit(userId, new CreateHabitRequest(
                name, "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null));
        habitIds.add(response.id());

        // HabitService.createCheckIn now rejects a check-in dated before the
        // habit's own createdAt — correctly so, but this test fixture needs
        // to simulate weeks of pre-existing history on a habit the test just
        // created. Backdating createdAt directly via SQL (JPA won't update
        // it: the column is updatable = false) is a test-only workaround,
        // not something production code needs.
        jdbcTemplate.update(
                "UPDATE habits SET created_at = ? WHERE id = ?",
                Timestamp.from(Instant.now().minus(60, ChronoUnit.DAYS)),
                response.id());

        return response.id();
    }

    private void checkInOnDay(Long habitId, int daysAgo) {
        Instant occurredAt = Instant.now().minus(daysAgo, ChronoUnit.DAYS);
        habitService.createCheckIn(userId, habitId, new CheckInRequest(occurredAt, 1, "manual"));
    }

    /**
     * Only the stronger-qualifying direction of a pair is ever surfaced as an
     * insight (see InsightService.computeForUser) — with perfectly symmetric
     * test data (identical check-in days for both habits), either direction
     * is an equally valid winner, so these helpers check the unordered pair
     * rather than a hardcoded habitA/habitB order.
     */
    private boolean hasInsightForPair(List<Insight> insights, Long x, Long y) {
        return insights.stream().anyMatch(i ->
                (x.equals(i.getHabitAId()) && y.equals(i.getHabitBId()))
                        || (y.equals(i.getHabitAId()) && x.equals(i.getHabitBId())));
    }

    private Insight findInsightForPair(List<Insight> insights, Long x, Long y) {
        return insights.stream()
                .filter(i -> (x.equals(i.getHabitAId()) && y.equals(i.getHabitBId()))
                        || (y.equals(i.getHabitAId()) && x.equals(i.getHabitBId())))
                .findFirst().orElseThrow();
    }

    @Test
    void surfacesInsight_whenSampleSizeAndScoreClearThreshold() {
        userId = "insight-test-user-1";
        Long a = createHabit("Coffee");
        Long b = createHabit("Walk");

        // 6 days where both happen (sample size >= 5, score 100%, and since
        // both habits are equally frequent — 6 of the same 30-day window —
        // lift is well above MIN_LIFT too: 1.0 / (6/30) = 5.0).
        for (int d = 1; d <= 6; d++) {
            checkInOnDay(a, d);
            checkInOnDay(b, d);
        }

        insightService.computeForUser(userId);

        assertThat(hasInsightForPair(insightService.listActive(userId), a, b)).isTrue();
    }

    @Test
    void suppressesInsight_whenSampleSizeTooSmall() {
        userId = "insight-test-user-2";
        Long a = createHabit("Coffee");
        Long b = createHabit("Walk");

        // Only 2 days of data — below MIN_SAMPLE_SIZE even though score is 100%.
        checkInOnDay(a, 1);
        checkInOnDay(b, 1);
        checkInOnDay(a, 2);
        checkInOnDay(b, 2);

        insightService.computeForUser(userId);

        assertThat(hasInsightForPair(insightService.listActive(userId), a, b)).isFalse();
    }

    @Test
    void suppressesInsight_whenLiftTooLow() {
        userId = "insight-test-user-4";
        Long a = createHabit("Gym");
        Long b = createHabit("Job applications");

        // B ("Job applications") happens on 20 of the last 30 days —
        // frequent on its own, regardless of A. A happens on 6 days, 4 of
        // which happen to overlap with B: a 67% raw score (clears
        // MIN_SAMPLE_SIZE and MIN_SCORE), but B's own baseline is already
        // 67%, so A isn't actually predictive of B — lift ~1.0, below
        // MIN_LIFT. This is the exact "gym correlates with job applications"
        // false-pattern case reported against the real app.
        for (int d = 1; d <= 20; d++) {
            checkInOnDay(b, d);
        }
        checkInOnDay(a, 1);
        checkInOnDay(a, 2);
        checkInOnDay(a, 3);
        checkInOnDay(a, 4);
        checkInOnDay(a, 25);
        checkInOnDay(a, 26);

        insightService.computeForUser(userId);

        assertThat(hasInsightForPair(insightService.listActive(userId), a, b)).isFalse();
    }

    @Test
    void retractsInsight_whenPairNoLongerQualifiesOnRecompute() {
        userId = "insight-test-user-5";
        Long a = createHabit("A");
        Long b = createHabit("B");

        for (int d = 1; d <= 6; d++) {
            checkInOnDay(a, d);
            checkInOnDay(b, d);
        }
        insightService.computeForUser(userId);
        assertThat(hasInsightForPair(insightService.listActive(userId), a, b)).isTrue();

        // Dilute B's base rate with more check-ins that don't overlap with A
        // — the absolute overlap with A is unchanged, but B is now frequent
        // enough on its own (24 of 30 days) that A no longer meaningfully
        // predicts it (lift drops from 5.0 to 1.25, below MIN_LIFT).
        for (int d = 7; d <= 24; d++) {
            checkInOnDay(b, d);
        }
        insightService.computeForUser(userId);

        assertThat(hasInsightForPair(insightService.listActive(userId), a, b)).isFalse();
    }

    @Test
    void dismissedInsight_isNotResurrectedByRecompute() {
        userId = "insight-test-user-3";
        Long a = createHabit("Coffee");
        Long b = createHabit("Walk");

        for (int d = 1; d <= 6; d++) {
            checkInOnDay(a, d);
            checkInOnDay(b, d);
        }

        insightService.computeForUser(userId);
        Insight created = findInsightForPair(insightService.listActive(userId), a, b);

        insightService.dismiss(userId, created.getId());
        insightService.computeForUser(userId);

        assertThat(hasInsightForPair(insightService.listActive(userId), a, b)).isFalse();
    }
}
