package com.habituate.api.coach;

import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.habits.Habit;
import org.junit.jupiter.api.Test;

import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Plain unit test, no Spring context — buildSnapshots only needs a
 * CheckInRepository, mocked here rather than hitting the real one.
 * habit.prePersist() stands in for JPA actually persisting the row, so
 * getCreatedAt() isn't null (Habit has no public setter for it).
 */
class CoachContextBuilderTest {

    @Test
    void buildSnapshots_carriesTheHabitsStatedMotivationThrough() {
        Habit habit = new Habit("user-1", "Meditate", "Wellness", "DAILY", 1);
        habit.prePersist();
        habit.setMotivation("So I'm calmer with my kids");

        CheckInRepository checkInRepository = mock(CheckInRepository.class);
        when(checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtDesc("user-1", null))
                .thenReturn(List.of());

        List<HabitSnapshot> snapshots =
                CoachContextBuilder.buildSnapshots(List.of(habit), checkInRepository, ZoneOffset.UTC);

        assertThat(snapshots).hasSize(1);
        assertThat(snapshots.get(0).motivation()).isEqualTo("So I'm calmer with my kids");
    }

    @Test
    void buildSnapshots_leavesMotivationNullWhenNeverSet() {
        Habit habit = new Habit("user-1", "Read", "Growth", "DAILY", 1);
        habit.prePersist();

        CheckInRepository checkInRepository = mock(CheckInRepository.class);
        when(checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtDesc("user-1", null))
                .thenReturn(List.of());

        List<HabitSnapshot> snapshots =
                CoachContextBuilder.buildSnapshots(List.of(habit), checkInRepository, ZoneOffset.UTC);

        assertThat(snapshots.get(0).motivation()).isNull();
    }
}
