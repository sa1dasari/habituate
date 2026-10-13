package com.habituate.api.feedback;

import java.time.Instant;
import java.util.List;

public record FeedbackResponse(
        Long id,
        String type,
        String page,
        String message,
        String stepsToReproduce,
        List<String> attachmentUrls,
        Instant createdAt) {
    public static FeedbackResponse from(Feedback feedback) {
        return new FeedbackResponse(
                feedback.getId(),
                feedback.getType(),
                feedback.getPage(),
                feedback.getMessage(),
                feedback.getStepsToReproduce(),
                feedback.getAttachmentUrls(),
                feedback.getCreatedAt());
    }
}
