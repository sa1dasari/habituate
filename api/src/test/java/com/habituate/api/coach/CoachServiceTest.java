package com.habituate.api.coach;

import com.habituate.api.common.ForbiddenException;
import com.habituate.api.events.CheckInEventPublisher;
import com.habituate.api.habits.CreateHabitRequest;
import com.habituate.api.habits.HabitRepository;
import com.habituate.api.habits.HabitResponse;
import com.habituate.api.habits.HabitService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * AnthropicClient is mocked throughout — these tests exercise CoachService's
 * own logic (persistence, adjustment validation/application, ownership
 * checks), not the real Anthropic API. The live Messages API shape (text +
 * tool_use blocks, the claude-sonnet-5 model id, this exact tool schema) was
 * verified separately with a real API call during development, not by an
 * automated test here — mocking the actual network call is still correct for
 * a unit/integration suite that shouldn't depend on an external service or a
 * billed API key being present in CI.
 */
@SpringBootTest
class CoachServiceTest {

    @Autowired
    private CoachService coachService;

    @Autowired
    private HabitService habitService;

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private CoachMessageRepository coachMessageRepository;

    @MockBean
    private AnthropicClient anthropicClient;

    @MockBean
    private CheckInEventPublisher checkInEventPublisher;

    private String userId;
    private Long habitId;

    @AfterEach
    void cleanup() {
        if (habitId != null) {
            habitService.deleteHabit(userId, habitId);
        }
        if (userId != null) {
            coachMessageRepository.findByUserIdOrderByCreatedAtAsc(userId)
                    .forEach(m -> coachMessageRepository.deleteById(m.getId()));
        }
    }

    private Long createHabit(String name) {
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                name, "General", "DAILY", 1, 3, null, "BOOLEAN", null, null, null
        ));
        return habit.id();
    }

    private AnthropicResponse textOnlyResponse(String text) {
        return new AnthropicResponse("msg_1", "assistant",
                List.of(new AnthropicContentBlock("text", text, null, null, null)), "end_turn");
    }

    private AnthropicResponse textPlusToolResponse(String text, Map<String, Object> toolInput) {
        return new AnthropicResponse("msg_2", "assistant", List.of(
                new AnthropicContentBlock("text", text, null, null, null),
                new AnthropicContentBlock("tool_use", null, "tool_1", "propose_habit_adjustment", toolInput)
        ), "tool_use");
    }

    private AnthropicResponse textPlusCreationToolResponse(String text, Map<String, Object> toolInput) {
        return new AnthropicResponse("msg_3", "assistant", List.of(
                new AnthropicContentBlock("text", text, null, null, null),
                new AnthropicContentBlock("tool_use", null, "tool_2", "propose_habit_creation", toolInput)
        ), "tool_use");
    }

    @Test
    void ask_persistsUserAndAssistantMessages() {
        userId = "coach-test-user-1";
        habitId = createHabit("Morning Walk");

        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textOnlyResponse("You're doing well this week."));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "How am I doing?");

        assertThat(reply.role()).isEqualTo("ASSISTANT");
        assertThat(reply.content()).isEqualTo("You're doing well this week.");
        assertThat(reply.adjustmentField()).isNull();

        List<CoachMessageResponse> history = coachService.listMessages(userId);
        assertThat(history).hasSize(2);
        assertThat(history.get(0).role()).isEqualTo("USER");
        assertThat(history.get(0).content()).isEqualTo("How am I doing?");
        assertThat(history.get(1).role()).isEqualTo("ASSISTANT");
    }

    @Test
    void ask_rejectsBlankMessage() {
        userId = "coach-test-user-2";
        assertThatThrownBy(() -> coachService.ask(userId, "UTC", "   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void ask_storesValidAdjustmentProposal() {
        userId = "coach-test-user-3";
        habitId = createHabit("Reading");

        Map<String, Object> toolInput = Map.of(
                "habitId", habitId.intValue(),
                "field", "weeklyTarget",
                "newValue", 2,
                "title", "Lower your weekly target",
                "description", "Set your weekly target to 2 instead of 3."
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusToolResponse("Here's an idea.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Help me make this easier.");

        assertThat(reply.adjustmentField()).isEqualTo("weeklyTarget");
        assertThat(reply.adjustmentCurrentValue()).isEqualTo(3);
        assertThat(reply.adjustmentNewValue()).isEqualTo(2);
        assertThat(reply.adjustmentStatus()).isEqualTo("PENDING");
        assertThat(reply.habitId()).isEqualTo(habitId);
        assertThat(reply.groundingLabel()).isEqualTo("Your check-ins · Reading · Last 7 days");

        // The habit itself must be untouched until confirmed.
        HabitResponse unchanged = habitService.listHabits(userId, "UTC").get(0);
        assertThat(unchanged.weeklyTarget()).isEqualTo(3);
    }

    @Test
    void ask_dropsAdjustment_whenHabitIdNotInGroundedList() {
        userId = "coach-test-user-4";
        habitId = createHabit("Journaling");

        Map<String, Object> toolInput = Map.of(
                "habitId", 999999,
                "field", "weeklyTarget",
                "newValue", 2,
                "title", "x",
                "description", "y"
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusToolResponse("Here's an idea.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Any ideas?");

        assertThat(reply.adjustmentField()).isNull();
        assertThat(reply.content()).isEqualTo("Here's an idea.");
    }

    @Test
    void ask_dropsAdjustment_whenFieldNotAdjustable() {
        userId = "coach-test-user-5";
        habitId = createHabit("Stretching");

        Map<String, Object> toolInput = Map.of(
                "habitId", habitId.intValue(),
                "field", "name",
                "newValue", 2,
                "title", "x",
                "description", "y"
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusToolResponse("Here's an idea.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Any ideas?");
        assertThat(reply.adjustmentField()).isNull();
    }

    @Test
    void confirmAdjustment_appliesChangeToHabit() {
        userId = "coach-test-user-6";
        habitId = createHabit("Gym");

        Map<String, Object> toolInput = Map.of(
                "habitId", habitId.intValue(),
                "field", "weeklyTarget",
                "newValue", 2,
                "title", "Lower your weekly target",
                "description", "Set your weekly target to 2 instead of 3."
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusToolResponse("Here's an idea.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Help?");
        CoachMessageResponse confirmed = coachService.confirmProposal(userId, reply.id());

        assertThat(confirmed.adjustmentStatus()).isEqualTo("CONFIRMED");
        HabitResponse updated = habitService.listHabits(userId, "UTC").get(0);
        assertThat(updated.weeklyTarget()).isEqualTo(2);
    }

    @Test
    void rejectAdjustment_leavesHabitUnchanged() {
        userId = "coach-test-user-7";
        habitId = createHabit("Meditation");

        Map<String, Object> toolInput = Map.of(
                "habitId", habitId.intValue(),
                "field", "weeklyTarget",
                "newValue", 2,
                "title", "x",
                "description", "y"
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusToolResponse("Here's an idea.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Help?");
        CoachMessageResponse rejected = coachService.rejectProposal(userId, reply.id());

        assertThat(rejected.adjustmentStatus()).isEqualTo("REJECTED");
        HabitResponse unchanged = habitService.listHabits(userId, "UTC").get(0);
        assertThat(unchanged.weeklyTarget()).isEqualTo(3);
    }

    @Test
    void confirmAdjustment_rejectsSecondAttempt_onAlreadyActedOnMessage() {
        userId = "coach-test-user-8";
        habitId = createHabit("Cooking");

        Map<String, Object> toolInput = Map.of(
                "habitId", habitId.intValue(),
                "field", "weeklyTarget",
                "newValue", 2,
                "title", "x",
                "description", "y"
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusToolResponse("Here's an idea.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Help?");
        coachService.confirmProposal(userId, reply.id());

        assertThatThrownBy(() -> coachService.confirmProposal(userId, reply.id()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void confirmAdjustment_rejectsOtherUsersMessage() {
        userId = "coach-test-user-9";
        habitId = createHabit("Budgeting");

        Map<String, Object> toolInput = Map.of(
                "habitId", habitId.intValue(),
                "field", "weeklyTarget",
                "newValue", 2,
                "title", "x",
                "description", "y"
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusToolResponse("Here's an idea.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Help?");

        assertThatThrownBy(() -> coachService.confirmProposal("someone-else", reply.id()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void confirmAdjustment_rejectsUnknownMessageId() {
        userId = "coach-test-user-10";
        assertThatThrownBy(() -> coachService.confirmProposal(userId, 9999999L))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void ask_storesValidCreationProposal() {
        userId = "coach-test-user-11";

        Map<String, Object> toolInput = Map.of(
                "name", "Evening Walk",
                "category", "Fitness",
                "cadenceTarget", 1,
                "title", "Create 'Evening Walk'",
                "description", "Creates a daily habit called 'Evening Walk'."
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusCreationToolResponse("Sure, here's one.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Create a habit for evening walks.");

        assertThat(reply.proposalType()).isEqualTo("CREATE_HABIT");
        assertThat(reply.adjustmentStatus()).isEqualTo("PENDING");
        assertThat(reply.creationHabit()).isNotNull();
        assertThat(reply.creationHabit().name()).isEqualTo("Evening Walk");
        assertThat(reply.creationHabit().category()).isEqualTo("Fitness");
        assertThat(reply.creationHabit().cadenceTarget()).isEqualTo(1);
        // Not created yet — that's confirmProposal's job, not ask()'s.
        assertThat(habitRepository.findByUserIdOrderByCreatedAtDesc(userId)).isEmpty();
    }

    @Test
    void confirmProposal_createsHabit_forCreationProposal() {
        userId = "coach-test-user-12";

        Map<String, Object> toolInput = Map.of(
                "name", "Evening Walk",
                "category", "Fitness",
                "cadenceTarget", 1,
                "title", "Create 'Evening Walk'",
                "description", "Creates a daily habit called 'Evening Walk'."
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusCreationToolResponse("Sure, here's one.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Create a habit for evening walks.");
        CoachMessageResponse confirmed = coachService.confirmProposal(userId, reply.id());

        assertThat(confirmed.adjustmentStatus()).isEqualTo("CONFIRMED");
        assertThat(confirmed.habitId()).isNotNull();
        habitId = confirmed.habitId();

        HabitResponse created = habitService.listHabits(userId, "UTC").get(0);
        assertThat(created.name()).isEqualTo("Evening Walk");
        assertThat(created.category()).isEqualTo("Fitness");
    }

    @Test
    void ask_defaultsMissingCreationFields() {
        userId = "coach-test-user-13";

        // Model omitted category/cadenceTarget entirely — only name + required card copy.
        Map<String, Object> toolInput = Map.of(
                "name", "Read before bed",
                "title", "Create 'Read before bed'",
                "description", "Creates a daily habit."
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusCreationToolResponse("Sure.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Create a reading habit.");

        assertThat(reply.creationHabit().category()).isEqualTo("General");
        assertThat(reply.creationHabit().cadenceTarget()).isEqualTo(1);
        assertThat(reply.creationHabit().trackingMode()).isEqualTo("BOOLEAN");
    }

    @Test
    void ask_dropsCreationProposal_whenNameMissing() {
        userId = "coach-test-user-14";

        Map<String, Object> toolInput = Map.of(
                "title", "Create a habit",
                "description", "x"
        );
        when(anthropicClient.sendMessage(anyString(), anyList(), anyList()))
                .thenReturn(textPlusCreationToolResponse("I can help with that.", toolInput));

        CoachMessageResponse reply = coachService.ask(userId, "UTC", "Create something.");

        assertThat(reply.proposalType()).isNull();
        assertThat(reply.content()).isEqualTo("I can help with that.");
    }
}
