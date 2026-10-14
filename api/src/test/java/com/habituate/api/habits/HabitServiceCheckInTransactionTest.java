package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.events.CheckInEventPublisher;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;

/**
 * Verifies that createCheckIn/deleteCheckIn are transactional: when the Kafka
 * publish fails, the Postgres write must not be left committed (see the
 * CLAUDE.md rule that a Postgres write and its Kafka publish must not drift).
 */
@SpringBootTest
class HabitServiceCheckInTransactionTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private CheckInRepository checkInRepository;

    @MockBean
    private CheckInEventPublisher checkInEventPublisher;

    private String userId;
    private Long habitId;

    @AfterEach
    void cleanup() {
        if (habitId != null) {
            habitService.deleteHabit(userId, habitId);
        }
    }

    @Test
    void createCheckIn_rollsBackDatabaseWrite_whenKafkaPublishFails() {
        userId = "transaction-test-user";
        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null
        )).id();

        doThrow(new IllegalStateException("simulated broker outage"))
                .when(checkInEventPublisher).publishCreated(org.mockito.ArgumentMatchers.any());

        assertThatThrownBy(() ->
                habitService.createCheckIn(userId, habitId, new CheckInRequest(null, 1, "manual"))
        ).isInstanceOf(IllegalStateException.class);

        List<CheckIn> persisted = checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtDesc(userId, habitId);
        assertThat(persisted).isEmpty();
    }

    @Test
    void deleteCheckIn_rollsBackDatabaseWrite_whenKafkaPublishFails() {
        userId = "transaction-test-user";
        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null
        )).id();

        CheckIn checkIn = habitService.createCheckIn(userId, habitId, new CheckInRequest(null, 1, "manual"));

        doThrow(new IllegalStateException("simulated broker outage"))
                .when(checkInEventPublisher).publishDeleted(org.mockito.ArgumentMatchers.any());

        assertThatThrownBy(() ->
                habitService.deleteCheckIn(userId, checkIn.getId())
        ).isInstanceOf(IllegalStateException.class);

        assertThat(checkInRepository.findById(checkIn.getId())).isPresent();
    }
}
