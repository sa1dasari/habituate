package com.habituate.api.users;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.coach.CoachMessageRepository;
import com.habituate.api.feedback.FeedbackRepository;
import com.habituate.api.goals.GoalRepository;
import com.habituate.api.groups.Challenge;
import com.habituate.api.groups.ChallengeCheckInRepository;
import com.habituate.api.groups.ChallengeParticipantRepository;
import com.habituate.api.groups.ChallengeRepository;
import com.habituate.api.groups.CheckInCheerRepository;
import com.habituate.api.groups.FriendshipRepository;
import com.habituate.api.groups.Group;
import com.habituate.api.groups.GroupMemberRepository;
import com.habituate.api.groups.GroupRepository;
import com.habituate.api.groups.GroupStreakRepository;
import com.habituate.api.groups.StreakFreezeRepository;
import com.habituate.api.habits.HabitRepository;
import com.habituate.api.habits.ShieldAwardRepository;
import com.habituate.api.notifications.AppNotificationRepository;
import com.habituate.api.notifications.PushTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * User-facing profile fields that don't belong in Firebase Auth (which only
 * covers displayName/photoURL/email) — dateOfBirth today, the same users row
 * UserTimezoneService writes to opportunistically. Kept as a separate service
 * since this one is a real user-facing endpoint (UserProfileController), not
 * a side effect of request handling.
 */
@Service
public class UserProfileService {

    private static final Logger log = LoggerFactory.getLogger(UserProfileService.class);
    private static final int MAX_AGE_YEARS = 130;
    private static final java.util.regex.Pattern USERNAME_PATTERN = java.util.regex.Pattern.compile("^[a-z0-9_]{3,20}$");

    private final UserRepository userRepository;
    private final CheckInCheerRepository checkInCheerRepository;
    private final ChallengeCheckInRepository challengeCheckInRepository;
    private final CheckInRepository checkInRepository;
    private final HabitRepository habitRepository;
    private final GoalRepository goalRepository;
    private final CoachMessageRepository coachMessageRepository;
    private final PushTokenRepository pushTokenRepository;
    private final FeedbackRepository feedbackRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupRepository groupRepository;
    private final GroupStreakRepository groupStreakRepository;
    private final StreakFreezeRepository streakFreezeRepository;
    private final ChallengeRepository challengeRepository;
    private final ChallengeParticipantRepository challengeParticipantRepository;
    private final FriendshipRepository friendshipRepository;
    private final ShieldAwardRepository shieldAwardRepository;
    private final AppNotificationRepository appNotificationRepository;

    public UserProfileService(UserRepository userRepository,
                               CheckInCheerRepository checkInCheerRepository,
                               ChallengeCheckInRepository challengeCheckInRepository,
                               CheckInRepository checkInRepository,
                               HabitRepository habitRepository,
                               GoalRepository goalRepository,
                               CoachMessageRepository coachMessageRepository,
                               PushTokenRepository pushTokenRepository,
                               FeedbackRepository feedbackRepository,
                               GroupMemberRepository groupMemberRepository,
                               GroupRepository groupRepository,
                               GroupStreakRepository groupStreakRepository,
                               StreakFreezeRepository streakFreezeRepository,
                               ChallengeRepository challengeRepository,
                               ChallengeParticipantRepository challengeParticipantRepository,
                               FriendshipRepository friendshipRepository,
                               ShieldAwardRepository shieldAwardRepository,
                               AppNotificationRepository appNotificationRepository) {
        this.userRepository = userRepository;
        this.checkInCheerRepository = checkInCheerRepository;
        this.challengeCheckInRepository = challengeCheckInRepository;
        this.checkInRepository = checkInRepository;
        this.habitRepository = habitRepository;
        this.goalRepository = goalRepository;
        this.coachMessageRepository = coachMessageRepository;
        this.pushTokenRepository = pushTokenRepository;
        this.feedbackRepository = feedbackRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupRepository = groupRepository;
        this.groupStreakRepository = groupStreakRepository;
        this.streakFreezeRepository = streakFreezeRepository;
        this.challengeRepository = challengeRepository;
        this.challengeParticipantRepository = challengeParticipantRepository;
        this.friendshipRepository = friendshipRepository;
        this.shieldAwardRepository = shieldAwardRepository;
        this.appNotificationRepository = appNotificationRepository;
    }

    public UserProfileResponse getProfile(String userId) {
        return userRepository.findById(userId)
                .map(this::toResponse)
                .orElse(new UserProfileResponse(null, null, null, null, null, null));
    }

    public boolean isUsernameAvailable(String username) {
        String normalized = normalizeUsername(username);
        return normalized != null && !userRepository.existsByUsernameIgnoreCase(normalized);
    }

    /** Idempotent re-save of the same username (no-op) is allowed — lets a client retry a
     * flaky request safely without it looking like a "username taken" error. */
    @Transactional
    public UserProfileResponse setUsername(String userId, String username) {
        String normalized = normalizeUsername(username);
        if (normalized == null) {
            throw new IllegalArgumentException(
                    "Username must be 3-20 characters, lowercase letters/numbers/underscore only");
        }

        User user = userRepository.findById(userId).orElseGet(() -> new User(userId, null));
        if (normalized.equals(user.getUsername())) {
            return toResponse(user);
        }
        if (userRepository.existsByUsernameIgnoreCase(normalized)) {
            throw new IllegalArgumentException("That username is already taken: " + normalized);
        }

        user.setUsername(normalized);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        return toResponse(user);
    }

    /** Excludes the searching user themselves — searching your own username to "find" yourself
     * isn't a useful result in an add-a-friend flow. */
    public List<UserSearchResult> searchByUsername(String userId, String query) {
        String trimmed = query == null ? "" : query.trim().toLowerCase();
        if (trimmed.length() < 2) {
            return List.of();
        }
        return userRepository.findTop10ByUsernameContainingIgnoreCaseAndIdNot(trimmed, userId).stream()
                .filter(u -> u.getUsername() != null)
                .map(u -> new UserSearchResult(u.getId(), u.getUsername(), photoUrlQuietly(u.getId())))
                .toList();
    }

    /** The only Firebase Admin lookup in this otherwise local-data-only service — photoURL has
     * no local column (Firebase Auth owns it, same as displayName), and result sets here are
     * capped at 10, so a per-row lookup is cheap enough not to warrant caching. Never fails the
     * search itself: a lookup error just means that one row shows no picture. */
    private String photoUrlQuietly(String uid) {
        if (FirebaseApp.getApps().isEmpty()) {
            return null;
        }
        try {
            return FirebaseAuth.getInstance().getUser(uid).getPhotoUrl();
        } catch (Exception e) {
            return null;
        }
    }

    /** Public (see FirebaseAuthFilter) — the login screen needs this *before* the user has a
     * token, to turn a typed username into the email Firebase's own sign-in call requires.
     * Returns empty for an unknown username or an account with no email on file, rather than
     * distinguishing the two — not confirming *why* a login identifier failed is standard
     * practice, same reasoning as a generic "invalid email or password" message. */
    public java.util.Optional<String> resolveEmailForUsername(String username) {
        if (username == null || username.isBlank() || FirebaseApp.getApps().isEmpty()) {
            return java.util.Optional.empty();
        }
        return userRepository.findByUsernameIgnoreCase(username.trim())
                .flatMap(user -> {
                    try {
                        String email = FirebaseAuth.getInstance().getUser(user.getId()).getEmail();
                        return java.util.Optional.ofNullable(email);
                    } catch (Exception e) {
                        return java.util.Optional.empty();
                    }
                });
    }

    private String normalizeUsername(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase();
        return USERNAME_PATTERN.matcher(normalized).matches() ? normalized : null;
    }

    /** The client always sends its current value for every field on save — not a sparse/partial patch. */
    @Transactional
    public UserProfileResponse updateProfile(String userId, UpdateUserProfileRequest request) {
        User user = userRepository.findById(userId).orElseGet(() -> new User(userId, null));
        user.setDateOfBirth(parseDateOfBirth(request.dateOfBirth()));
        user.setPhoneNumber(blankToNull(request.phoneNumber()));
        user.setAddress(blankToNull(request.address()));
        user.setGender(blankToNull(request.gender()));
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        return toResponse(user);
    }

    private UserProfileResponse toResponse(User user) {
        return new UserProfileResponse(user.getTimezone(), user.getDateOfBirth(), user.getPhoneNumber(),
                user.getAddress(), user.getGender(), user.getUsername());
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * Deletes every row this user owns, then the Firebase Auth user itself —
     * required for Apple/Google Play store review once account creation exists.
     * Deliberate tradeoff: deleting the creator of a shared group or challenge
     * deletes it entirely for every other member/participant too, since there's
     * no ownership-transfer feature to reassign it to someone else instead.
     * The Firebase deleteUser call is last and its failure is swallowed (logged,
     * not re-thrown) — the local data is already gone and can't be un-deleted,
     * so surfacing an error at that point would only confuse the user without
     * being able to undo anything.
     */
    @Transactional
    public void deleteAccount(String userId) {
        List<Long> ownCheckInIds = checkInRepository.findByUserId(userId).stream()
                .map(CheckIn::getId)
                .toList();
        if (!ownCheckInIds.isEmpty()) {
            checkInCheerRepository.deleteByCheckInIdIn(ownCheckInIds);
        }
        checkInCheerRepository.deleteByUserId(userId);
        challengeCheckInRepository.deleteByUserId(userId);
        checkInRepository.deleteByUserId(userId);
        habitRepository.deleteByUserId(userId);
        streakFreezeRepository.deleteByUserId(userId); // personal Shield Day freezes
        shieldAwardRepository.deleteByUserId(userId);
        goalRepository.deleteByUserId(userId);
        coachMessageRepository.deleteByUserId(userId);
        pushTokenRepository.deleteByUserId(userId);
        feedbackRepository.deleteByUserId(userId);
        appNotificationRepository.deleteByUserId(userId);
        groupMemberRepository.deleteByUserId(userId);

        for (Group group : groupRepository.findByCreatedBy(userId)) {
            groupMemberRepository.deleteByGroupId(group.getId());
            groupStreakRepository.deleteByGroupId(group.getId());
            streakFreezeRepository.deleteByGroupId(group.getId());
            groupRepository.deleteById(group.getId());
        }

        for (Challenge challenge : challengeRepository.findByCreatedBy(userId)) {
            challengeParticipantRepository.deleteByChallengeId(challenge.getId());
            challengeCheckInRepository.deleteByChallengeId(challenge.getId());
            challengeRepository.deleteById(challenge.getId());
        }
        challengeParticipantRepository.deleteByUserId(userId);

        friendshipRepository.deleteByRequesterIdOrRecipientId(userId, userId);

        userRepository.deleteById(userId);

        deleteFirebaseUserQuietly(userId);
    }

    private void deleteFirebaseUserQuietly(String userId) {
        if (FirebaseApp.getApps().isEmpty()) {
            return; // dev fallback (demo-user) — no Firebase project configured
        }
        try {
            FirebaseAuth.getInstance().deleteUser(userId);
        } catch (Exception e) {
            log.warn("Could not delete Firebase user {}: {}", userId, e.getMessage());
        }
    }

    private LocalDate parseDateOfBirth(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        LocalDate date;
        try {
            date = LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Invalid dateOfBirth, expected YYYY-MM-DD: " + value);
        }
        LocalDate today = LocalDate.now();
        if (date.isAfter(today)) {
            throw new IllegalArgumentException("dateOfBirth cannot be in the future: " + date);
        }
        if (date.isBefore(today.minusYears(MAX_AGE_YEARS))) {
            throw new IllegalArgumentException("dateOfBirth is implausibly far in the past: " + date);
        }
        return date;
    }
}
