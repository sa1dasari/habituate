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

    private static UpdateUserProfileRequest dob(String dateOfBirth) {
        return new UpdateUserProfileRequest(dateOfBirth, null, null, null);
    }

    @Test
    void getProfile_defaultsToNulls_whenUserHasNoRow() {
        UserProfileResponse profile = userProfileService.getProfile("profile-test-user-none");
        assertThat(profile.timezone()).isNull();
        assertThat(profile.dateOfBirth()).isNull();
        assertThat(profile.phoneNumber()).isNull();
        assertThat(profile.address()).isNull();
        assertThat(profile.gender()).isNull();
    }

    @Test
    void updateProfile_createsRow_whenNoneExists() {
        userId = "profile-test-user-1";
        UserProfileResponse updated = userProfileService.updateProfile(userId, dob("1990-05-15"));
        assertThat(updated.dateOfBirth()).isEqualTo(LocalDate.of(1990, 5, 15));

        UserProfileResponse fetched = userProfileService.getProfile(userId);
        assertThat(fetched.dateOfBirth()).isEqualTo(LocalDate.of(1990, 5, 15));
    }

    @Test
    void updateProfile_preservesExistingTimezone() {
        userId = "profile-test-user-2";
        userRepository.save(new User(userId, "America/New_York"));

        UserProfileResponse updated = userProfileService.updateProfile(userId, dob("2000-01-01"));
        assertThat(updated.timezone()).isEqualTo("America/New_York");
        assertThat(updated.dateOfBirth()).isEqualTo(LocalDate.of(2000, 1, 1));
    }

    @Test
    void updateProfile_blankDateOfBirthClearsIt() {
        userId = "profile-test-user-3";
        userProfileService.updateProfile(userId, dob("1990-05-15"));

        UserProfileResponse cleared = userProfileService.updateProfile(userId, dob(""));
        assertThat(cleared.dateOfBirth()).isNull();
    }

    @Test
    void updateProfile_rejectsFutureDate() {
        userId = "profile-test-user-4";
        assertThatThrownBy(() -> userProfileService.updateProfile(userId, dob(LocalDate.now().plusDays(1).toString())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateProfile_rejectsImplausiblyOld() {
        userId = "profile-test-user-5";
        assertThatThrownBy(() -> userProfileService.updateProfile(userId, dob("1800-01-01")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateProfile_rejectsUnparseable() {
        userId = "profile-test-user-6";
        assertThatThrownBy(() -> userProfileService.updateProfile(userId, dob("not-a-date")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateProfile_savesPhoneAddressAndGender() {
        userId = "profile-test-user-7";
        UserProfileResponse updated = userProfileService.updateProfile(
                userId, new UpdateUserProfileRequest(null, "+1 555-0100", "123 Main St", "Non-binary"));

        assertThat(updated.phoneNumber()).isEqualTo("+1 555-0100");
        assertThat(updated.address()).isEqualTo("123 Main St");
        assertThat(updated.gender()).isEqualTo("Non-binary");

        UserProfileResponse fetched = userProfileService.getProfile(userId);
        assertThat(fetched.phoneNumber()).isEqualTo("+1 555-0100");
        assertThat(fetched.address()).isEqualTo("123 Main St");
        assertThat(fetched.gender()).isEqualTo("Non-binary");
    }

    @Test
    void updateProfile_blankPhoneAddressGenderClearThem() {
        userId = "profile-test-user-8";
        userProfileService.updateProfile(userId, new UpdateUserProfileRequest(null, "555-0100", "Somewhere", "Woman"));

        UserProfileResponse cleared = userProfileService.updateProfile(userId, new UpdateUserProfileRequest(null, "  ", "", null));
        assertThat(cleared.phoneNumber()).isNull();
        assertThat(cleared.address()).isNull();
        assertThat(cleared.gender()).isNull();
    }
}
