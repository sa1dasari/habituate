package com.habituate.api.notifications;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Plain unit test, no Spring context — JavaMailSender is mocked directly
 * rather than hitting the real SMTP transport, same reasoning as
 * ReminderSchedulerTest's @MockBean ExpoPushService. Never exercises the
 * real AWS SES endpoint.
 */
class InviteEmailServiceTest {

    @Test
    void sendFriendRequestEmail_stripsNewlinesFromAUserControlledDisplayName() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        InviteEmailService service = new InviteEmailService(mailSender, "noreply@habituate.app");

        service.sendFriendRequestEmail("friend@example.com", "Bob\r\nBcc: attacker@evil.com");

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());
        SimpleMailMessage sent = captor.getValue();
        assertThat(sent.getSubject()).doesNotContain("\r").doesNotContain("\n");
        assertThat(sent.getSubject()).contains("Bob Bcc: attacker@evil.com wants to be friends on Habituate");
        assertThat(sent.getTo()).containsExactly("friend@example.com");
    }

    @Test
    void sendGroupInviteEmail_buildsSubjectAndBodyFromInviterAndGroupName() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        InviteEmailService service = new InviteEmailService(mailSender, "noreply@habituate.app");

        service.sendGroupInviteEmail("friend@example.com", "Alice", "Morning Run");

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());
        SimpleMailMessage sent = captor.getValue();
        assertThat(sent.getSubject()).isEqualTo("Alice invited you to \"Morning Run\" on Habituate");
        assertThat(sent.getText()).contains("Alice invited you to share the habit \"Morning Run\"");
    }

    @Test
    void send_skipsSilentlyWhenFromAddressIsNotConfigured() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        InviteEmailService service = new InviteEmailService(mailSender, "");

        service.sendFriendRequestEmail("friend@example.com", "Bob");

        verify(mailSender, never()).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
    }
}
