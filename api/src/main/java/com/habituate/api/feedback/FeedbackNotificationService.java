package com.habituate.api.feedback;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Emails a notification every time a user submits feedback, instead of
 * needing an in-app admin list — simpler for a solo-maintainer project.
 * Best-effort only: a misconfigured/failed send is logged and swallowed,
 * never surfaced to the submitting user, since the feedback itself is
 * already safely persisted in Postgres regardless of whether the email
 * goes out.
 */
@Service
public class FeedbackNotificationService {

    private static final Logger log = LoggerFactory.getLogger(FeedbackNotificationService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String notifyAddress;

    public FeedbackNotificationService(
            JavaMailSender mailSender,
            @Value("${spring.mail.username:}") String fromAddress,
            @Value("${feedback.notification-email:}") String notifyAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.notifyAddress = notifyAddress;
    }

    public void notifyNewFeedback(Feedback feedback) {
        if (fromAddress == null || fromAddress.isBlank() || notifyAddress == null || notifyAddress.isBlank()) {
            log.info("Feedback notification email not configured — skipping (feedback id={})", feedback.getId());
            return;
        }
        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            mail.setFrom(fromAddress);
            mail.setTo(notifyAddress);
            mail.setSubject(buildSubject(feedback));
            mail.setText(buildBody(feedback));
            mailSender.send(mail);
        } catch (Exception e) {
            log.warn("Could not send feedback notification email for feedback id={}: {}", feedback.getId(), e.getMessage());
        }
    }

    private String buildSubject(Feedback feedback) {
        String kind = Feedback.BUG.equals(feedback.getType()) ? "Bug report" : "Suggestion";
        return feedback.getPage() != null
                ? String.format("[Habituate] %s — %s", kind, feedback.getPage())
                : String.format("[Habituate] %s", kind);
    }

    private String buildBody(Feedback feedback) {
        StringBuilder body = new StringBuilder();
        body.append("Type: ").append(feedback.getType()).append('\n');
        if (feedback.getPage() != null) {
            body.append("Page: ").append(feedback.getPage()).append('\n');
        }
        body.append("User: ").append(feedback.getUserId()).append('\n');
        if (feedback.getAppVersion() != null || feedback.getPlatform() != null) {
            body.append("App: ")
                    .append(feedback.getAppVersion() != null ? feedback.getAppVersion() : "?")
                    .append(" (")
                    .append(feedback.getPlatform() != null ? feedback.getPlatform() : "?")
                    .append(")\n");
        }
        body.append('\n').append(feedback.getMessage()).append('\n');

        if (feedback.getStepsToReproduce() != null) {
            body.append("\nSteps to reproduce:\n").append(feedback.getStepsToReproduce()).append('\n');
        }

        if (feedback.getAttachmentUrls() != null && !feedback.getAttachmentUrls().isEmpty()) {
            body.append("\nAttachments:\n");
            for (String url : feedback.getAttachmentUrls()) {
                body.append("- ").append(url).append('\n');
            }
        }

        return body.toString();
    }
}
