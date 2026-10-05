package com.habituate.api.notifications;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class PushTokenServiceTest {

    @Autowired
    private PushTokenService pushTokenService;

    @Autowired
    private PushTokenRepository pushTokenRepository;

    private String token;

    @AfterEach
    void cleanup() {
        if (token != null) {
            pushTokenService.unregister(token);
        }
    }

    @Test
    void register_createsNewToken() {
        token = "ExponentPushToken[test-token-1]";
        pushTokenService.register("push-test-user-1", token, "ios");

        PushToken saved = pushTokenRepository.findByToken(token).orElseThrow();
        assertThat(saved.getUserId()).isEqualTo("push-test-user-1");
        assertThat(saved.getPlatform()).isEqualTo("ios");
    }

    @Test
    void register_sameTokenDifferentUser_reassignsOwner() {
        token = "ExponentPushToken[test-token-2]";
        pushTokenService.register("push-test-user-a", token, "android");
        pushTokenService.register("push-test-user-b", token, "android");

        PushToken saved = pushTokenRepository.findByToken(token).orElseThrow();
        assertThat(saved.getUserId()).isEqualTo("push-test-user-b");
        assertThat(pushTokenRepository.findAll().stream().filter(t -> token.equals(t.getToken())).count())
                .isEqualTo(1);
    }

    @Test
    void register_rejectsBlankToken() {
        assertThatThrownBy(() -> pushTokenService.register("push-test-user-c", "", "ios"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unregister_removesToken() {
        token = "ExponentPushToken[test-token-3]";
        pushTokenService.register("push-test-user-d", token, "ios");

        pushTokenService.unregister(token);

        assertThat(pushTokenRepository.findByToken(token)).isEmpty();
        token = null; // already cleaned up
    }
}
