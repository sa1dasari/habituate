package com.habituate.api.feedback;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Notification email isn't mocked here on purpose: application.properties
 * leaves spring.mail.username/feedback.notification-email blank by default,
 * so FeedbackNotificationService.notifyNewFeedback short-circuits before
 * ever touching JavaMailSender — these tests exercise the real bean wiring
 * without making a network call.
 */
@SpringBootTest
class FeedbackServiceTest {

    private static final String USER_ID = "feedback-test-user";

    @Autowired
    private FeedbackService feedbackService;

    @Autowired
    private FeedbackRepository feedbackRepository;

    // Deletes one by one via the base deleteById (transactional on its own)
    // rather than the bulk deleteByUserId under test, same reasoning as
    // UserProfileServiceDeleteAccountTest's cleanup — keeps this independent
    // of the code being tested, and a bare derived delete query called
    // outside a @Transactional service method has no transaction to run in.
    @AfterEach
    void cleanup() {
        feedbackRepository.findByUserIdOrderByCreatedAtDesc(USER_ID)
                .forEach(f -> feedbackRepository.deleteById(f.getId()));
    }

    @Test
    void submit_savesBugReportWithAllFields() {
        FeedbackResponse response = feedbackService.submit(
                USER_ID,
                new SubmitFeedbackRequest(
                        Feedback.BUG, "Habits", "The streak icon looks wrong", "1. Open Habits\n2. Look at streak",
                        List.of("https://example.com/a.png", "https://example.com/b.png"), "1.0.0", "ios"));

        assertThat(response.id()).isNotNull();
        assertThat(response.type()).isEqualTo(Feedback.BUG);
        assertThat(response.page()).isEqualTo("Habits");
        assertThat(response.message()).isEqualTo("The streak icon looks wrong");
        assertThat(response.stepsToReproduce()).isEqualTo("1. Open Habits\n2. Look at streak");
        assertThat(response.attachmentUrls()).containsExactly("https://example.com/a.png", "https://example.com/b.png");
    }

    @Test
    void submit_allowsSuggestionWithNoOptionalFields() {
        FeedbackResponse response = feedbackService.submit(
                USER_ID, new SubmitFeedbackRequest(Feedback.SUGGESTION, null, "Add a dark theme toggle", null, null, null, null));

        assertThat(response.type()).isEqualTo(Feedback.SUGGESTION);
        assertThat(response.page()).isNull();
        assertThat(response.stepsToReproduce()).isNull();
        assertThat(response.attachmentUrls()).isEmpty();
    }

    @Test
    void submit_rejectsInvalidType() {
        assertThatThrownBy(() -> feedbackService.submit(
                USER_ID, new SubmitFeedbackRequest("OTHER", null, "message", null, null, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void submit_rejectsBlankMessage() {
        assertThatThrownBy(() -> feedbackService.submit(
                USER_ID, new SubmitFeedbackRequest(Feedback.BUG, null, "   ", null, null, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void submit_rejectsTooManyAttachments() {
        List<String> tooMany = List.of("1", "2", "3", "4", "5", "6");
        assertThatThrownBy(() -> feedbackService.submit(
                USER_ID, new SubmitFeedbackRequest(Feedback.BUG, null, "message", null, tooMany, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void deleteByUserId_removesAllOfThatUsersFeedback() {
        feedbackService.submit(USER_ID, new SubmitFeedbackRequest(Feedback.BUG, null, "one", null, null, null, null));
        feedbackService.submit(USER_ID, new SubmitFeedbackRequest(Feedback.SUGGESTION, null, "two", null, null, null, null));

        feedbackService.deleteByUserId(USER_ID);

        assertThat(feedbackRepository.findByUserIdOrderByCreatedAtDesc(USER_ID)).isEmpty();
    }
}
