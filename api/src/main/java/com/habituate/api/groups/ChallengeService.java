package com.habituate.api.groups;

import com.habituate.api.common.ForbiddenException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;

@Service
public class ChallengeService {

    private final ChallengeRepository challengeRepository;
    private final ChallengeParticipantRepository participantRepository;
    private final UserLookupService userLookupService;

    public ChallengeService(
            ChallengeRepository challengeRepository,
            ChallengeParticipantRepository participantRepository,
            UserLookupService userLookupService) {
        this.challengeRepository = challengeRepository;
        this.participantRepository = participantRepository;
        this.userLookupService = userLookupService;
    }

    @Transactional
    public ChallengeResponse create(String userId, CreateChallengeRequest request) {
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

        Challenge challenge = challengeRepository.save(new Challenge(
                name, request.description(), userId, targetCount, periodStart, periodEnd));
        participantRepository.save(new ChallengeParticipant(challenge.getId(), userId));

        return toResponse(challenge, userId);
    }

    @Transactional
    public ChallengeResponse join(String userId, Long challengeId) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found: " + challengeId));

        if (participantRepository.findByChallengeIdAndUserId(challengeId, userId).isPresent()) {
            throw new IllegalArgumentException("Already joined this challenge");
        }

        participantRepository.save(new ChallengeParticipant(challengeId, userId));
        return toResponse(challenge, userId);
    }

    @Transactional
    public ChallengeResponse adjustProgress(String userId, Long challengeId, ChallengeProgressRequest request) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found: " + challengeId));

        ChallengeParticipant participant = participantRepository.findByChallengeIdAndUserId(challengeId, userId)
                .orElseThrow(() -> new ForbiddenException("Join this challenge before logging progress"));

        int delta = request.delta() == null ? 0 : request.delta();
        participant.setProgressCount(Math.max(0, participant.getProgressCount() + delta));
        participantRepository.save(participant);

        return toResponse(challenge, userId);
    }

    public List<ChallengeResponse> listMine(String userId) {
        return participantRepository.findByUserId(userId).stream()
                .map(ChallengeParticipant::getChallengeId)
                .distinct()
                .map(id -> challengeRepository.findById(id).orElse(null))
                .filter(c -> c != null)
                .map(c -> toResponse(c, userId))
                .toList();
    }

    /** All not-yet-ended challenges, joined or not — what "Browse" shows per design/Community.png. */
    public List<ChallengeResponse> browse(String userId) {
        return challengeRepository.findByPeriodEndGreaterThanEqualOrderByPeriodStartAsc(LocalDate.now()).stream()
                .map(c -> toResponse(c, userId))
                .toList();
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

    private ChallengeResponse toResponse(Challenge challenge, String viewingUserId) {
        List<ChallengeParticipant> participants = participantRepository.findByChallengeId(challenge.getId());

        Optional<ChallengeParticipant> mine = participants.stream()
                .filter(p -> p.getUserId().equals(viewingUserId))
                .findFirst();

        int myProgress = mine.map(ChallengeParticipant::getProgressCount).orElse(0);
        int target = challenge.getTargetCount() == null ? 1 : challenge.getTargetCount();
        int percent = target > 0 ? Math.min(100, Math.round((myProgress * 100f) / target)) : 0;

        List<GroupResponse.Participant> participantDtos = participants.stream()
                .map(p -> new GroupResponse.Participant(userLookupService.resolve(p.getUserId()).displayName()))
                .toList();

        return new ChallengeResponse(
                challenge.getId(), challenge.getName(), challenge.getDescription(), target,
                challenge.getPeriodStart(), challenge.getPeriodEnd(),
                myProgress, percent, mine.isPresent(),
                participantDtos, participants.size()
        );
    }
}
