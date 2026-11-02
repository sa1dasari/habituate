package com.habituate.api.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Out-of-band email for friend requests and group invites — the one real
 * known gap this closes: before this, an invitee only ever found out by
 * opening the app and checking Community's pending list themselves (see
 * SKILLS.md Phase 6's documented gap). Same transport as
 * feedback.FeedbackNotificationService (spring.mail.*, provider-agnostic
 * SMTP via JavaMailSender) — in production this points at AWS SES's SMTP
 * interface, chosen over SendGrid for this project. Swapping providers is a
 * MAIL_SMTP_HOST/PORT/USERNAME/PASSWORD env var change, not a code change.
 *
 * Best-effort only, exactly like FeedbackNotificationService: a failed or
 * unconfigured send is logged and swallowed, never surfaces to the caller,
 * and never blocks the friend request / invite itself from succeeding — the
 * in-app notification (AppNotification) and the Community page's pending
 * list are the actual source of truth regardless of whether this email
 * goes out.
 */
@Service
public class InviteEmailService {

    private static final Logger log = LoggerFactory.getLogger(InviteEmailService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public InviteEmailService(
            JavaMailSender mailSender,
            @Value("${spring.mail.username:}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    public void sendFriendRequestEmail(String toEmail, String requesterDisplayName) {
        String name = stripNewlines(requesterDisplayName);
        send(toEmail,
                name + " wants to be friends on Habituate",
                name + " sent you a friend request on Habituate.\n\n"
                        + "Open the app to accept or decline — Community tab, Friends section.\n");
    }

    public void sendGroupInviteEmail(String toEmail, String inviterDisplayName, String groupName) {
        String inviter = stripNewlines(inviterDisplayName);
        String group = stripNewlines(groupName);
        send(toEmail,
                inviter + " invited you to \"" + group + "\" on Habituate",
                inviter + " invited you to share the habit \"" + group + "\" on Habituate.\n\n"
                        + "Open the app to accept or decline — Community tab, Shared Habits section.\n");
    }

    // User-controlled (display name, group name) and only ever meant to be a
    // single line — strips embedded CR/LF so it can't inject extra headers
    // via SimpleMailMessage.setSubject, regardless of what the mail
    // transport itself would or wouldn't block.
    private static String stripNewlines(String value) {
        return value == null ? "" : value.replaceAll("[\\r\\n]+", " ").trim();
    }

    private void send(String toEmail, String subject, String body) {
        if (fromAddress == null || fromAddress.isBlank() || toEmail == null || toEmail.isBlank()) {
            log.info("Invite email not configured or no recipient email — skipping (\"{}\")", subject);
            return;
        }
        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            mail.setFrom(fromAddress);
            mail.setTo(toEmail);
            mail.setSubject(subject);
            mail.setText(body);
            mailSender.send(mail);
        } catch (Exception e) {
            log.warn("Could not send invite email (\"{}\") to {}: {}", subject, toEmail, e.getMessage());
        }
    }
}
