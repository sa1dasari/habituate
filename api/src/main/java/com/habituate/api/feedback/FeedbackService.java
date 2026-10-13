package com.habituate.api.feedback;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FeedbackService {

    private static final int MAX_MESSAGE_LENGTH = 4000;
    private static final int MAX_STEPS_LENGTH = 4000;
    private static final int MAX_ATTACHMENTS = 5;

    private final FeedbackRepository feedbackRepository;
    private final FeedbackNotificationService feedbackNotificationService;

    public FeedbackService(FeedbackRepository feedbackRepository, FeedbackNotificationService feedbackNotificationService) {
        this.feedbackRepository = feedbackRepository;
        this.feedbackNotificationService = feedbackNotificationService;
    }

    @Transactional
    public FeedbackResponse submit(String userId, SubmitFeedbackRequest request) {
        String type = request.type();
        if (!Feedback.BUG.equals(type) && !Feedback.SUGGESTION.equals(type)) {
            throw new IllegalArgumentException("type must be BUG or SUGGESTION");
        }
        String message = request.message() == null ? "" : request.message().trim();
        if (message.isEmpty()) {
            throw new IllegalArgumentException("message is required");
        }
        if (message.length() > MAX_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("message is too long (max " + MAX_MESSAGE_LENGTH + " characters)");
        }
        String stepsToReproduce = blankToNull(request.stepsToReproduce());
        if (stepsToReproduce != null && stepsToReproduce.length() > MAX_STEPS_LENGTH) {
            throw new IllegalArgumentException("stepsToReproduce is too long (max " + MAX_STEPS_LENGTH + " characters)");
        }
        List<String> attachmentUrls = request.attachmentUrls() == null ? List.of() : request.attachmentUrls();
        if (attachmentUrls.size() > MAX_ATTACHMENTS) {
            throw new IllegalArgumentException("Too many attachments (max " + MAX_ATTACHMENTS + ")");
        }

        Feedback feedback = new Feedback(
                userId,
                type,
                blankToNull(request.page()),
                message,
                stepsToReproduce,
                attachmentUrls,
                request.appVersion(),
                request.platform());
        Feedback saved = feedbackRepository.save(feedback);
        feedbackNotificationService.notifyNewFeedback(saved);
        return FeedbackResponse.from(saved);
    }

    @Transactional
    public void deleteByUserId(String userId) {
        feedbackRepository.deleteByUserId(userId);
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
