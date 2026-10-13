package com.habituate.api.feedback;

import java.util.List;

/**
 * type: "BUG" or "SUGGESTION". page: which app screen this is about (free text,
 * e.g. "Habits"), optional. stepsToReproduce: optional. attachmentUrls: Firebase
 * Storage download URLs already uploaded by the client, optional. platform:
 * "ios"/"android", informational only.
 */
public record SubmitFeedbackRequest(
        String type,
        String page,
        String message,
        String stepsToReproduce,
        List<String> attachmentUrls,
        String appVersion,
        String platform) {
}
