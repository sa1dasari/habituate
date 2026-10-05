package com.habituate.api.users;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class UserProfileServiceTest {

    @Autowired
    private UserProfileService userProfileService;

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
    void getProfile_defaultsToNulls_whenUserHasNoRow() {
        UserProfileResponse profile = userProfileService.getProfile("profile-test-user-none");
        assertThat(profile.timezone()).isNull();
        assertThat(profile.dateOfBirth()).isNull();
    }

    @Test
    void updateDateOfBirth_createsRow_whenNoneExists() {
        userId = "profile-test-user-1";
        UserProfileResponse updated = userProfileService.updateDateOfBirth(userId, "1990-05-15");
        assertThat(updated.dateOfBirth()).isEqualTo(LocalDate.of(1990, 5, 15));

        UserProfileResponse fetched = userProfileService.getProfile(userId);
        assertThat(fetched.dateOfBirth()).isEqualTo(LocalDate.of(1990, 5, 15));
    }

    @Test
    void updateDateOfBirth_preservesExistingTimezone() {
        userId = "profile-test-user-2";
        userRepository.save(new User(userId, "America/New_York"));

        UserProfileResponse updated = userProfileService.updateDateOfBirth(userId, "2000-01-01");
        assertThat(updated.timezone()).isEqualTo("America/New_York");
        assertThat(updated.dateOfBirth()).isEqualTo(LocalDate.of(2000, 1, 1));
    }

    @Test
    void updateDateOfBirth_blankClearsIt() {
        userId = "profile-test-user-3";
        userProfileService.updateDateOfBirth(userId, "1990-05-15");

        UserProfileResponse cleared = userProfileService.updateDateOfBirth(userId, "");
        assertThat(cleared.dateOfBirth()).isNull();
    }

    @Test
    void updateDateOfBirth_rejectsFutureDate() {
        userId = "profile-test-user-4";
        assertThatThrownBy(() -> userProfileService.updateDateOfBirth(userId, LocalDate.now().plusDays(1).toString()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateDateOfBirth_rejectsImplausiblyOld() {
        userId = "profile-test-user-5";
        assertThatThrownBy(() -> userProfileService.updateDateOfBirth(userId, "1800-01-01"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateDateOfBirth_rejectsUnparseable() {
        userId = "profile-test-user-6";
        assertThatThrownBy(() -> userProfileService.updateDateOfBirth(userId, "not-a-date"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
