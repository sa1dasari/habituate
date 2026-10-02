package com.habituate.api.groups;

import com.habituate.api.common.DuplicateCheckInException;
import com.habituate.api.common.ForbiddenException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

@Service
public class ChallengeService {

    /** Per the user's "1 day to 1 year" range decision. */
    private static final long MAX_PERIOD_DAYS = 365;

    private final ChallengeRepository challengeRepository;
    private final ChallengeParticipantRepository participantRepository;
    private final ChallengeCheckInRepository checkInRepository;
    private final UserLookupService userLookupService;

    public ChallengeService(
            ChallengeRepository challengeRepository,
            ChallengeParticipantRepository participantRepository,
            ChallengeCheckInRepository checkInRepository,
            UserLookupService userLookupService) {
        this.challengeRepository = challengeRepository;
        this.participantRepository = participantRepository;
        this.checkInRepository = checkInRepository;
        this.userLookupService = userLookupService;
    }

    @Transactional
    public ChallengeResponse create(String userId, CreateChallengeRequest request, String timezone) {
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Challenge name is required");
        }
        Integer targetCount = request.targetCount() == null || request.targetCount() < 1 ? 1 : request.targetCount();
        LocalDate periodStart = parseDate(request.periodStart(), "periodStart");
        LocalDate periodEnd = parseDate(request.periodEnd(), "periodEnd");
        if (periodEnd.isBefore(periodStart)) {
            throw new IllegalArgumentException("periodEnd cannot be before periodStart");
        }
        if (ChronoUnit.DAYS.between(periodStart, periodEnd) > MAX_PERIOD_DAYS) {
            throw new IllegalArgumentException("A challenge can run at most " + MAX_PERIOD_DAYS + " days");
        }
        String visibility = normalizeVisibility(request.visibility());

        Challenge challenge = challengeRepository.save(new Challenge(
                name, request.description(), userId, targetCount, periodStart, periodEnd, visibility));
        participantRepository.save(new ChallengeParticipant(challenge.getId(), userId));

        return toResponse(challenge, userId, resolveZone(timezone));
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

    /** Boolean-only, one log per day — mirrors a BOOLEAN habit's duplicate-day guard. */
    @Transactional
    public ChallengeResponse logCheckIn(String userId, Long challengeId, String timezone) {
        Challenge challenge = requireParticipant(userId, challengeId);
        ZoneId zone = resolveZone(timezone);
        LocalDate today = LocalDate.now(zone);
        Instant dayStart = today.atStartOfDay(zone).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(zone).toInstant();

        if (checkInRepository.existsByChallengeIdAndUserIdAndOccurredAtBetween(challengeId, userId, dayStart, dayEnd)) {
            throw new DuplicateCheckInException("Challenge " + challengeId + " is already logged for " + today);
        }

        checkInRepository.save(new ChallengeCheckIn(challengeId, userId, Instant.now()));
        return toResponse(challenge, userId, zone);
    }

    /** Undoes today's log, if any — "unlog" rather than a general per-entry delete, since there's at most one a day. */
    @Transactional
    public ChallengeResponse unlogCheckIn(String userId, Long challengeId, String timezone) {
        Challenge challenge = requireParticipant(userId, challengeId);
        ZoneId zone = resolveZone(timezone);
        LocalDate today = LocalDate.now(zone);
        Instant dayStart = today.atStartOfDay(zone).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(zone).toInstant();

        ChallengeCheckIn todaysCheckIn = checkInRepository
                .findByChallengeIdAndUserIdAndOccurredAtBetween(challengeId, userId, dayStart, dayEnd)
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
        return challengeRepository
                .findByVisibilityAndPeriodEndGreaterThanEqualOrderByPeriodStartAsc(Challenge.PUBLIC, LocalDate.now(zone))
                .stream()
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

        Optional<ChallengeParticipant> mine = participants.stream()
                .filter(p -> p.getUserId().equals(viewingUserId))
                .findFirst();

        int myProgress = mine.isPresent()
                ? (int) checkInRepository.countByChallengeIdAndUserId(challenge.getId(), viewingUserId)
                : 0;
        boolean checkedInToday = mine.isPresent() && checkInRepository.existsByChallengeIdAndUserIdAndOccurredAtBetween(
                challenge.getId(), viewingUserId,
                LocalDate.now(zone).atStartOfDay(zone).toInstant(),
                LocalDate.now(zone).plusDays(1).atStartOfDay(zone).toInstant());

        int target = challenge.getTargetCount() == null ? 1 : challenge.getTargetCount();
        int percent = target > 0 ? Math.min(100, Math.round((myProgress * 100f) / target)) : 0;

        List<GroupResponse.Participant> participantDtos = participants.stream()
                .map(p -> new GroupResponse.Participant(userLookupService.resolve(p.getUserId()).displayName()))
                .toList();

        return new ChallengeResponse(
                challenge.getId(), challenge.getName(), challenge.getDescription(), target,
                challenge.getPeriodStart(), challenge.getPeriodEnd(), challenge.getVisibility(),
                myProgress, percent, mine.isPresent(), checkedInToday,
                participantDtos, participants.size()
        );
    }
}
