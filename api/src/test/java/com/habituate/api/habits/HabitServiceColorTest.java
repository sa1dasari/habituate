package com.habituate.api.habits;

import com.habituate.api.common.ForbiddenException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Per-habit tower colour: palette-key validation, sparse update semantics, ownership. */
@SpringBootTest
class HabitServiceColorTest {

    private static final String USER = "color-test-user-1";

    @Autowired
    private HabitService habitService;

    private Long habitId;

    @AfterEach
    void cleanup() {
        if (habitId != null) {
            habitService.deleteHabit(USER, habitId);
            habitId = null;
        }
    }

    private HabitResponse create(String color) {
        HabitResponse r = habitService.createHabit(USER, new CreateHabitRequest(
                "Color Test", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null, null, color));
        habitId = r.id();
        return r;
    }

    private HabitResponse updateColor(String color) {
        return habitService.updateHabit(USER, habitId, new UpdateHabitRequest(
                null, null, null, null, null, null, null, null, null, null, null, null, null, color));
    }

    @Test
    void createWithColor_persistsAndReturnsIt() {
        HabitResponse r = create("teal");
        assertThat(r.color()).isEqualTo("teal");
        assertThat(habitService.listHabits(USER, null).stream()
                .filter(h -> h.id().equals(habitId)).findFirst().orElseThrow().color()).isEqualTo("teal");
    }

    @Test
    void createWithoutColor_isNull() {
        assertThat(create(null).color()).isNull();
    }

    @Test
    void createWithInvalidKey_isRejectedWithSpecificMessage() {
        assertThatThrownBy(() -> create("chartreuse"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Pick one of the tower colours");
    }

    @Test
    void update_setsNullLeavesUnchangedAndEmptyClears() {
        create(null);
        assertThat(updateColor("violet").color()).isEqualTo("violet");
        assertThat(updateColor(null).color()).isEqualTo("violet");
        assertThat(updateColor("").color()).isNull();
    }

    @Test
    void update_rejectsInvalidKey() {
        create("coral");
        assertThatThrownBy(() -> updateColor("#FF0000"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Pick one of the tower colours");
        assertThat(updateColor(null).color()).isEqualTo("coral");
    }

    @Test
    void anotherUser_cannotRecolourTheHabit() {
        create("coral");
        assertThatThrownBy(() -> habitService.updateHabit("color-test-user-2", habitId, new UpdateHabitRequest(
                null, null, null, null, null, null, null, null, null, null, null, null, null, "pink")))
                .isInstanceOf(ForbiddenException.class);
        assertThat(updateColor(null).color()).isEqualTo("coral");
    }
}
