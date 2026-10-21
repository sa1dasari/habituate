package com.habituate.api.groups;

import com.habituate.api.common.DuplicateCheckInException;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.notifications.AppNotification;
import com.habituate.api.notifications.AppNotificationService;
import com.habituate.api.notifications.ExpoPushMessage;
import com.habituate.api.notifications.ExpoPushService;
import com.habituate.api.notifications.PushTokenRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ChallengeService {

    /** Per the user's "1 day to 1 year" range decision. */
    private static final long MAX_PERIOD_DAYS = 365;

    private final ChallengeRepository challengeRepository;
    private final ChallengeParticipantRepository participantRepository;
    private final ChallengeCheckInRepository checkInRepository;
    private final UserLookupService userLookupService;
    private final FriendshipService friendshipService;
    private final PushTokenRepository pushTokenRepository;
    private final ExpoPushService expoPushService;
    private final AppNotificationService appNotificationService;

    public ChallengeService(
            ChallengeRepository challengeRepository,
            ChallengeParticipantRepository participantRepository,
            ChallengeCheckInRepository checkInRepository,
            UserLookupService userLookupService,
            FriendshipService friendshipService,
            PushTokenRepository pushTokenRepository,
            ExpoPushService expoPushService,
            AppNotificationService appNotificationService) {
        this.challengeRepository = challengeRepository;
        this.participantRepository = participantRepository;
        this.checkInRepository = checkInRepository;
        this.userLookupService = userLookupService;
        this.friendshipService = friendshipService;
        this.pushTokenRepository = pushTokenRepository;
        this.expoPushService = expoPushService;
        this.appNotificationService = appNotificationService;
    }

    @Transactional
    public ChallengeResponse create(String userId, CreateChallengeRequest request, String timezone) {
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Challenge name is required");
        }
        Integer targetCount = request.targetCount() == null || request.targetCount() < 1 ? 1 : request.targetCount();
        LocalDate periodStart = parseDate(request.periodStart(), "periodStart");
        LocalDate periodEnd = parseOptionalDate(request.periodEnd(), "periodEnd");
        if (periodEnd != null) {
            if (periodEnd.isBefore(periodStart)) {
                throw new IllegalArgumentException("periodEnd cannot be before periodStart");
            }
            if (ChronoUnit.DAYS.between(periodStart, periodEnd) > MAX_PERIOD_DAYS) {
                throw new IllegalArgumentException("A challenge can run at most " + MAX_PERIOD_DAYS + " days");
            }
        }
        String visibility = normalizeVisibility(request.visibility());
        String trackingMode = normalizeTrackingMode(request.trackingMode());
        String cadenceType = normalizeCadenceType(request.cadenceType());
        Integer weeklyQuota = null;
        String customDays = null;
        if (Challenge.WEEKLY_QUOTA.equals(cadenceType)) {
            if (request.weeklyQuota() == null || request.weeklyQuota() < 1 || request.weeklyQuota() > 7) {
                throw new IllegalArgumentException("weeklyQuota must be between 1 and 7 for a weekly-quota cadence");
            }
            weeklyQuota = request.weeklyQuota();
        } else if (Challenge.CUSTOM_DAYS.equals(cadenceType)) {
            customDays = normalizeCustomDays(request.customDays());
        }
        LocalTime reminderTime = parseOptionalTime(request.reminderTime());
        String icon = blankToNull(request.icon());
        String color = blankToNull(request.color());

        Challenge challenge = challengeRepository.save(new Challenge(
                name, request.description(), userId, targetCount, periodStart, periodEnd, visibility,
                icon, color, trackingMode, cadenceType, weeklyQuota, customDays, reminderTime));
        participantRepository.save(new ChallengeParticipant(challenge.getId(), userId));

        return toResponse(challenge, userId, resolveZone(timezone));
    }

    /** Only the creator may edit. periodStart and trackingMode are deliberately not editable:
     * changing the start date after people have logged against it doesn't make sense, and
     * flipping BOOLEAN/COUNT mid-challenge would make every already-logged entry's meaning
     * ambiguous (a BOOLEAN "1" isn't a COUNT amount). periodEnd may still change (including to
     * null, i.e. switching to open-ended) and the same MAX_PERIOD_DAYS/ordering checks apply. */
    @Transactional
    public ChallengeResponse update(String userId, Long challengeId, CreateChallengeRequest request, String timezone) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found: " + challengeId));
        if (!userId.equals(challenge.getCreatedBy())) {
            throw new ForbiddenException("Only the creator can edit this challenge");
        }

        String name = request.name() == null ? "" : request.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Challenge name is required");
        }
        Integer targetCount = request.targetCount() == null || request.targetCount() < 1 ? 1 : request.targetCount();
        LocalDate periodEnd = parseOptionalDate(request.periodEnd(), "periodEnd");
        if (periodEnd != null) {
            if (periodEnd.isBefore(challenge.getPeriodStart())) {
                throw new IllegalArgumentException("periodEnd cannot be before periodStart");
            }
            if (ChronoUnit.DAYS.between(challenge.getPeriodStart(), periodEnd) > MAX_PERIOD_DAYS) {
                throw new IllegalArgumentException("A challenge can run at most " + MAX_PERIOD_DAYS + " days");
            }
        }
        String visibility = normalizeVisibility(request.visibility());
        String cadenceType = normalizeCadenceType(request.cadenceType());
        Integer weeklyQuota = null;
        String customDays = null;
        if (Challenge.WEEKLY_QUOTA.equals(cadenceType)) {
            if (request.weeklyQuota() == null || request.weeklyQuota() < 1 || request.weeklyQuota() > 7) {
                throw new IllegalArgumentException("weeklyQuota must be between 1 and 7 for a weekly-quota cadence");
            }
            weeklyQuota = request.weeklyQuota();
        } else if (Challenge.CUSTOM_DAYS.equals(cadenceType)) {
            customDays = normalizeCustomDays(request.customDays());
        }

        challenge.setName(name);
        challenge.setDescription(request.description());
        challenge.setTargetCount(targetCount);
        challenge.setPeriodEnd(periodEnd);
        challenge.setVisibility(visibility);
        challenge.setIcon(blankToNull(request.icon()));
        challenge.setColor(blankToNull(request.color()));
        challenge.setCadenceType(cadenceType);
        challenge.setWeeklyQuota(weeklyQuota);
        challenge.setCustomDays(customDays);
        challenge.setReminderTime(parseOptionalTime(request.reminderTime()));
        challengeRepository.save(challenge);

        return toResponse(challenge, userId, resolveZone(timezone));
    }

    /** Creator-only — deletes the whole challenge for every participant, not just the
     * creator's own participation, same single-owner tradeoff as Shared Habits and account
     * deletion. Each other participant gets a best-effort notification first. */
    @Transactional
    public void delete(String userId, Long challengeId) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found: " + challengeId));
        if (!userId.equals(challenge.getCreatedBy())) {
            throw new ForbiddenException("Only the creator can delete this challenge");
        }

        List<String> otherParticipantIds = participantRepository.findByChallengeId(challengeId).stream()
                .map(ChallengeParticipant::getUserId)
                .filter(id -> !id.equals(userId))
                .toList();
        appNotificationService.notifyAll(otherParticipantIds, AppNotification.CHALLENGE_DELETED, "Challenge deleted",
                "\"" + challenge.getName() + "\" was deleted by its creator", null, null, null);

        participantRepository.deleteByChallengeId(challengeId);
        checkInRepository.deleteByChallengeId(challengeId);
        challengeRepository.deleteById(challengeId);
    }

    @Transactional
    public ChallengeResponse join(String userId, Long challengeId, String timezone) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found: " + challengeId));

        if (participantRepository.findByChallengeIdAndUserId(challengeId, userId).isPresent()) {
            throw new IllegalArgumentException("Already joined this challenge");
        }

        participantRepository.save(new ChallengeParticipant(challengeId, userId));
        return toResponse(challenge, userId, resolveZone(timezone));
    }

    /** Adds a friend directly as a participant — mirrors GroupService.invite, minus the accept
     * step, since a Challenge carries no per-member setup (like picking a habit to link). */
    @Transactional
    public ChallengeResponse invite(String userId, Long challengeId, String friendUserId, String timezone) {
        Challenge challenge = requireParticipant(userId, challengeId);

        if (!friendshipService.areFriends(userId, friendUserId)) {
            throw new ForbiddenException("Can only invite accepted friends to a challenge");
        }
        if (participantRepository.findByChallengeIdAndUserId(challengeId, friendUserId).isPresent()) {
            throw new IllegalArgumentException("That friend has already joined this challenge");
        }

        participantRepository.save(new ChallengeParticipant(challengeId, friendUserId));

        String inviterName = userLookupService.resolve(userId).displayName();
        String title = "You're invited to a challenge";
        String body = inviterName + " invited you to \"" + challenge.getName() + "\"";

        List<ExpoPushMessage> messages = pushTokenRepository.findByUserId(friendUserId).stream()
                .map(token -> new ExpoPushMessage(token.getToken(), title, body, Map.of("challengeId", challengeId)))
                .toList();
        if (!messages.isEmpty()) {
            expoPushService.send(messages);
        }
        appNotificationService.notify(friendUserId, AppNotification.CHALLENGE_INVITE, title, body, null, challengeId, null);

        return toResponse(challenge, userId, resolveZone(timezone));
    }

    /** BOOLEAN challenges: one log per day (dup-checked). COUNT challenges: any number of logs a
     * day, each carrying a value — defaults to 1 when omitted. */
    @Transactional
    public ChallengeResponse logCheckIn(String userId, Long challengeId, Integer value, String timezone) {
        Challenge challenge = requireParticipant(userId, challengeId);
        ZoneId zone = resolveZone(timezone);
        LocalDate today = LocalDate.now(zone);
        Instant dayStart = today.atStartOfDay(zone).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(zone).toInstant();

        if (Challenge.COUNT.equals(challenge.getTrackingMode())) {
            checkInRepository.save(new ChallengeCheckIn(challengeId, userId, Instant.now(), value));
        } else {
            if (checkInRepository.existsByChallengeIdAndUserIdAndOccurredAtBetween(challengeId, userId, dayStart, dayEnd)) {
                throw new DuplicateCheckInException("Challenge " + challengeId + " is already logged for " + today);
            }
            checkInRepository.save(new ChallengeCheckIn(challengeId, userId, Instant.now()));
        }
        notifyOtherParticipantsOfCheckIn(challenge, userId);
        return toResponse(challenge, userId, zone);
    }

    /** Best-effort fan-out — notifyAll never throws, so a notification failure can't
     * undo a check-in that already succeeded. */
    private void notifyOtherParticipantsOfCheckIn(Challenge challenge, String loggedByUserId) {
        String actorName = userLookupService.resolve(loggedByUserId).displayName();
        List<String> otherParticipantIds = participantRepository.findByChallengeId(challenge.getId()).stream()
                .map(ChallengeParticipant::getUserId)
                .filter(id -> !id.equals(loggedByUserId))
                .toList();
        appNotificationService.notifyAll(otherParticipantIds, AppNotification.CHALLENGE_CHECKIN, "Logged today",
                actorName + " logged today for \"" + challenge.getName() + "\"", null, challenge.getId(), null);
    }

    /** Undoes today's most recent log. For a BOOLEAN challenge that's "the" entry for today
     * (unlog); for a COUNT challenge it's the single most recent entry, not every entry today. */
    @Transactional
    public ChallengeResponse unlogCheckIn(String userId, Long challengeId, String timezone) {
        Challenge challenge = requireParticipant(userId, challengeId);
        ZoneId zone = resolveZone(timezone);
        LocalDate today = LocalDate.now(zone);
        Instant dayStart = today.atStartOfDay(zone).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(zone).toInstant();

        ChallengeCheckIn todaysCheckIn = checkInRepository
                .findTopByChallengeIdAndUserIdAndOccurredAtBetweenOrderByOccurredAtDesc(challengeId, userId, dayStart, dayEnd)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Challenge " + challengeId + " has no log for " + today + " to undo"));

        checkInRepository.delete(todaysCheckIn);
        return toResponse(challenge, userId, zone);
    }

    private Challenge requireParticipant(String userId, Long challengeId) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found: " + challengeId));
        participantRepository.findByChallengeIdAndUserId(challengeId, userId)
                .orElseThrow(() -> new ForbiddenException("Join this challenge before logging progress"));
        return challenge;
    }

    public List<ChallengeResponse> listMine(String userId, String timezone) {
        ZoneId zone = resolveZone(timezone);
        return participantRepository.findByUserId(userId).stream()
                .map(ChallengeParticipant::getChallengeId)
                .distinct()
                .map(id -> challengeRepository.findById(id).orElse(null))
                .filter(c -> c != null)
                .map(c -> toResponse(c, userId, zone))
                .toList();
    }

    /** Only PUBLIC, not-yet-ended challenges — PRIVATE ones aren't discoverable, only joinable by id. */
    public List<ChallengeResponse> browse(String userId, String timezone) {
        ZoneId zone = resolveZone(timezone);
        return challengeRepository.findBrowsable(Challenge.PUBLIC, LocalDate.now(zone)).stream()
                .map(c -> toResponse(c, userId, zone))
                .toList();
    }

    private String normalizeVisibility(String value) {
        if (value == null || value.isBlank()) {
            return Challenge.PRIVATE;
        }
        String upper = value.trim().toUpperCase();
        if (upper.equals(Challenge.PUBLIC) || upper.equals(Challenge.PRIVATE)) {
            return upper;
        }
        throw new IllegalArgumentException("Invalid visibility, expected PUBLIC or PRIVATE: " + value);
    }

    private String normalizeTrackingMode(String value) {
        if (value == null || value.isBlank()) {
            return Challenge.BOOLEAN;
        }
        String upper = value.trim().toUpperCase();
        if (upper.equals(Challenge.BOOLEAN) || upper.equals(Challenge.COUNT)) {
            return upper;
        }
        throw new IllegalArgumentException("Invalid trackingMode, expected BOOLEAN or COUNT: " + value);
    }

    private String normalizeCadenceType(String value) {
        if (value == null || value.isBlank()) {
            return Challenge.DAILY;
        }
        String upper = value.trim().toUpperCase();
        if (upper.equals(Challenge.DAILY) || upper.equals(Challenge.WEEKLY_QUOTA) || upper.equals(Challenge.CUSTOM_DAYS)) {
            return upper;
        }
        throw new IllegalArgumentException("Invalid cadenceType, expected DAILY, WEEKLY_QUOTA or CUSTOM_DAYS: " + value);
    }

    private String normalizeCustomDays(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("customDays is required for a CUSTOM_DAYS cadence");
        }
        String[] parts = value.split(",");
        for (String part : parts) {
            try {
                int day = Integer.parseInt(part.trim());
                if (day < 1 || day > 7) {
                    throw new NumberFormatException();
                }
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("customDays must be a comma-separated list of 1-7: " + value);
            }
        }
        return value.trim();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private LocalDate parseDate(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Invalid " + field + ", expected YYYY-MM-DD: " + value);
        }
    }

    private LocalDate parseOptionalDate(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return parseDate(value, field);
    }

    private LocalTime parseOptionalTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalTime.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Invalid reminderTime, expected HH:mm: " + value);
        }
    }

    /** Falls back to UTC when the client sends no zone or an unparseable one — same convention as HabitService. */
    private ZoneId resolveZone(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(timezone.trim());
        } catch (DateTimeException ex) {
            return ZoneOffset.UTC;
        }
    }

    private ChallengeResponse toResponse(Challenge challenge, String viewingUserId, ZoneId zone) {
        List<ChallengeParticipant> participants = participantRepository.findByChallengeId(challenge.getId());
        boolean isCount = Challenge.COUNT.equals(challenge.getTrackingMode());
        int target = challenge.getTargetCount() == null ? 1 : challenge.getTargetCount();
        Instant dayStart = LocalDate.now(zone).atStartOfDay(zone).toInstant();
        Instant dayEnd = LocalDate.now(zone).plusDays(1).atStartOfDay(zone).toInstant();

        List<ChallengeResponse.Participant> participantDtos = participants.stream()
                .map(p -> {
                    String userId = p.getUserId();
                    int progress;
                    boolean checkedInToday;
                    if (isCount) {
                        progress = checkInRepository.findByChallengeIdAndUserId(challenge.getId(), userId)
                                .stream().mapToInt(ChallengeCheckIn::getValue).sum();
                        checkedInToday = false;
                    } else {
                        progress = (int) checkInRepository.countByChallengeIdAndUserId(challenge.getId(), userId);
                        checkedInToday = checkInRepository.existsByChallengeIdAndUserIdAndOccurredAtBetween(
                                challenge.getId(), userId, dayStart, dayEnd);
                    }
                    int percent = target > 0 ? Math.min(100, Math.round((progress * 100f) / target)) : 0;
                    UserProfile profile = userLookupService.resolve(userId);
                    return new ChallengeResponse.Participant(userId, profile.displayName(), progress, percent, checkedInToday, profile.photoUrl());
                })
                .toList();

        Optional<ChallengeResponse.Participant> mine = participantDtos.stream()
                .filter(p -> p.userId().equals(viewingUserId))
                .findFirst();
        int myProgress = mine.map(ChallengeResponse.Participant::progress).orElse(0);
        int myPercent = mine.map(ChallengeResponse.Participant::progressPercent).orElse(0);
        boolean myCheckedInToday = mine.map(ChallengeResponse.Participant::checkedInToday).orElse(false);

        return new ChallengeResponse(
                challenge.getId(), challenge.getName(), challenge.getDescription(), target,
                challenge.getPeriodStart(), challenge.getPeriodEnd(), challenge.getVisibility(),
                challenge.getIcon(), challenge.getColor(), challenge.getTrackingMode(), challenge.getCadenceType(),
                challenge.getWeeklyQuota(), challenge.getCustomDays(), challenge.getReminderTime(),
                myProgress, myPercent, mine.isPresent(), myCheckedInToday,
                participantDtos, participants.size(),
                viewingUserId.equals(challenge.getCreatedBy())
        );
    }
}
