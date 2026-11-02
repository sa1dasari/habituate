package com.habituate.api.coach;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CoachPromptsTest {

    private static HabitSnapshot snapshot(String motivation) {
        return new HabitSnapshot(
                1L, "Meditate", "Wellness", "BOOLEAN",
                1, null, null,
                3, 5,
                2, 7, 10, 30,
                motivation
        );
    }

    @Test
    void systemPrompt_includesTheHabitsStatedMotivationWhenPresent() {
        String prompt = CoachPrompts.systemPrompt(List.of(snapshot("So I'm calmer with my kids")));

        assertThat(prompt).contains("So I'm calmer with my kids");
    }

    @Test
    void systemPrompt_omitsMotivationLineWhenNotSet() {
        String withNull = CoachPrompts.systemPrompt(List.of(snapshot(null)));
        String withBlank = CoachPrompts.systemPrompt(List.of(snapshot("   ")));

        assertThat(withNull).doesNotContain("stated reason");
        assertThat(withBlank).doesNotContain("stated reason");
    }
}
