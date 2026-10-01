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
        return response.id();
    }

    private void checkInOnDay(Long habitId, int daysAgo) {
        Instant occurredAt = Instant.now().minus(daysAgo, ChronoUnit.DAYS);
        habitService.createCheckIn(userId, habitId, new CheckInRequest(occurredAt, 1, "manual"));
    }

    @Test
    void surfacesInsight_whenSampleSizeAndScoreClearThreshold() {
        userId = "insight-test-user-1";
        Long a = createHabit("Coffee");
        Long b = createHabit("Walk");

        // 6 days where both happen (sample size >= 5, score 100%).
        for (int d = 1; d <= 6; d++) {
            checkInOnDay(a, d);
            checkInOnDay(b, d);
        }

        insightService.computeForUser(userId);

        List<Insight> active = insightService.listActive(userId);
        boolean found = active.stream().anyMatch(i -> a.equals(i.getHabitAId()) && b.equals(i.getHabitBId()));
        assertThat(found).isTrue();
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

        List<Insight> active = insightService.listActive(userId);
        boolean found = active.stream().anyMatch(i -> a.equals(i.getHabitAId()) && b.equals(i.getHabitBId()));
        assertThat(found).isFalse();
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
        Insight created = insightService.listActive(userId).stream()
                .filter(i -> a.equals(i.getHabitAId()) && b.equals(i.getHabitBId()))
                .findFirst().orElseThrow();

        insightService.dismiss(userId, created.getId());
        insightService.computeForUser(userId);

        List<Insight> activeAfter = insightService.listActive(userId);
        boolean stillActive = activeAfter.stream().anyMatch(i -> a.equals(i.getHabitAId()) && b.equals(i.getHabitBId()));
        assertThat(stillActive).isFalse();
    }
}
