package com.habituate.api.users;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class UserTimezoneServiceTest {

    @Autowired
    private UserTimezoneService userTimezoneService;

    @Autowired
    private UserRepository userRepository;

    private String userId;

    @AfterEach
    void cleanup() {
        if (userId != null) {
            userRepository.deleteById(userId);
        }
    }

    @Test
    void recordTimezone_createsNewUser() {
        userId = "tz-test-user-1";
        userTimezoneService.recordTimezone(userId, "America/New_York");

        User user = userRepository.findById(userId).orElseThrow();
        assertThat(user.getTimezone()).isEqualTo("America/New_York");
    }

    @Test
    void recordTimezone_updatesExistingUser() {
        userId = "tz-test-user-2";
        userTimezoneService.recordTimezone(userId, "America/New_York");
        userTimezoneService.recordTimezone(userId, "Asia/Tokyo");

        User user = userRepository.findById(userId).orElseThrow();
        assertThat(user.getTimezone()).isEqualTo("Asia/Tokyo");
    }

    @Test
    void recordTimezone_ignoresBlankAndInvalidZones() {
        userId = "tz-test-user-3";
        userTimezoneService.recordTimezone(userId, "");
        userTimezoneService.recordTimezone(userId, "Not/AZone");

        assertThat(userRepository.findById(userId)).isEmpty();
    }

    @Test
    void recordTimezone_noOpWhenUnchanged() {
        userId = "tz-test-user-4";
        userTimezoneService.recordTimezone(userId, "America/New_York");
        User first = userRepository.findById(userId).orElseThrow();

        userTimezoneService.recordTimezone(userId, "America/New_York");
        User second = userRepository.findById(userId).orElseThrow();

        assertThat(second.getUpdatedAt()).isEqualTo(first.getUpdatedAt());
    }
}
