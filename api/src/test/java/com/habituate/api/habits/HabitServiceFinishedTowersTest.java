package com.habituate.api.habits;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** HabitService.listFinishedTowers — board 58's combined list: flat, every
 * closed segment of the caller's own non-archived habits, with the owning
 * habit's name/category/color and no 2-segment cap. */
@SpringBootTest
class HabitServiceFinishedTowersTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private final List<String> ownerUserIds = new ArrayList<>();
    private final List<Long> habitIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (int i = 0; i < habitIds.size(); i += 1) {
            habitService.deleteHabit(ownerUserIds.get(i), habitIds.get(i));
        }
    }

    private Long createDailyHabit(String userId, String name) {
        HabitResponse response = habitService.createHabit(userId, new CreateHabitRequest(
                name, "Fitness", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null, 1));
        ownerUserIds.add(userId);
        habitIds.add(response.id());
        return response.id();
    }

    private void backdateHabitCreation(Long habitId, int daysAgo) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                entityManager.createNativeQuery("UPDATE habits SET created_at = ?1 WHERE id = ?2")
                        .setParameter(1, Instant.now().minus(daysAgo, ChronoUnit.DAYS))
                        .setParameter(2, habitId)
                        .executeUpdate());
        entityManager.clear();
    }

    /** Same backdate approach as HabitServiceTopOutTest: ages the current open
     * segment so a 1-day cap top-out actually has somewhere to land. */
    private void backdateCurrentSegment(Long habitId, int daysAgo) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                entityManager.createNativeQuery(
                                "UPDATE habit_towers SET started_at = ?1 WHERE habit_id = ?2 AND topped_out_at IS NULL")
                        .setParameter(1, Instant.now().minus(daysAgo, ChronoUnit.DAYS))
                        .setParameter(2, habitId)
                        .executeUpdate());
        entityManager.clear();
    }

    private void checkIn(String userId, Long habitId, int daysAgo) {
        habitService.createCheckIn(userId, habitId,
                new com.habituate.api.checkins.CheckInRequest(Instant.now().minus(daysAgo, ChronoUnit.DAYS), null, null),
                "UTC");
    }

    @Test
    void listFinishedTowers_isEmptyWhenNothingHasToppedOut() {
        String userId = "finished-test-1";
        createDailyHabit(userId, "Read");

        assertThat(habitService.listFinishedTowers(userId)).isEmpty();
    }

    @Test
    void listFinishedTowers_includesHabitDetailsAndFloorCount() {
        String userId = "finished-test-2";
        Long habitId = createDailyHabit(userId, "Read");
        backdateHabitCreation(habitId, 5);
        backdateCurrentSegment(habitId, 5);
        checkIn(userId, habitId, 3);
        checkIn(userId, habitId, 1);
        habitService.topOutHabit(userId, habitId, "UTC");

        var finished = habitService.listFinishedTowers(userId);

        assertThat(finished).hasSize(1);
        FinishedTowerResponse row = finished.get(0);
        assertThat(row.habitId()).isEqualTo(habitId);
        assertThat(row.habitName()).isEqualTo("Read");
        assertThat(row.category()).isEqualTo("Fitness");
        assertThat(row.floorCount()).isEqualTo(2);
        assertThat(row.toppedOutAt()).isNotNull();
        assertThat(row.autoToppedOut()).isFalse();
    }

    @Test
    void listFinishedTowers_ordersNewestFinishedFirstAcrossHabits() {
        String userId = "finished-test-3";
        Long a = createDailyHabit(userId, "Read");
        Long b = createDailyHabit(userId, "Run");
        backdateCurrentSegment(a, 5);
        habitService.topOutHabit(userId, a, "UTC");
        backdateCurrentSegment(b, 5);
        habitService.topOutHabit(userId, b, "UTC");

        var finished = habitService.listFinishedTowers(userId);

        assertThat(finished).hasSize(2);
        assertThat(finished.get(0).habitName()).isEqualTo("Run");
        assertThat(finished.get(1).habitName()).isEqualTo("Read");
    }

    @Test
    void listFinishedTowers_includesSeveralFinishedTowersOfTheSameHabitWithTheirOwnDates() {
        String userId = "finished-test-4";
        Long habitId = createDailyHabit(userId, "Read");
        backdateCurrentSegment(habitId, 5);
        habitService.topOutHabit(userId, habitId, "UTC");
        backdateCurrentSegment(habitId, 3);
        habitService.topOutHabit(userId, habitId, "UTC");

        var finished = habitService.listFinishedTowers(userId);

        assertThat(finished).hasSize(2);
        assertThat(finished).allMatch(row -> row.habitId().equals(habitId));
        assertThat(finished.get(0).toppedOutAt()).isAfter(finished.get(1).toppedOutAt());
        assertThat(finished.get(0).segmentId()).isNotEqualTo(finished.get(1).segmentId());
    }

    @Test
    void listFinishedTowers_excludesAnArchivedHabitsSegments() {
        String userId = "finished-test-5";
        Long habitId = createDailyHabit(userId, "Read");
        backdateCurrentSegment(habitId, 5);
        habitService.topOutHabit(userId, habitId, "UTC");
        habitService.updateHabit(userId, habitId, new UpdateHabitRequest(
                null, null, null, null, null, null, null, null, null, null, true, null, null));

        assertThat(habitService.listFinishedTowers(userId)).isEmpty();
    }

    @Test
    void listFinishedTowers_neverReturnsAnotherUsersSegments() {
        String owner = "finished-test-6-owner";
        String other = "finished-test-6-other";
        Long habitId = createDailyHabit(owner, "Read");
        backdateCurrentSegment(habitId, 5);
        habitService.topOutHabit(owner, habitId, "UTC");

        assertThat(habitService.listFinishedTowers(other)).isEmpty();
        assertThat(habitService.listFinishedTowers(owner)).hasSize(1);
    }
}
