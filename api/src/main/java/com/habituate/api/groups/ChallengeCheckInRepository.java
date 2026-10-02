package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface ChallengeCheckInRepository extends JpaRepository<ChallengeCheckIn, Long> {
    boolean existsByChallengeIdAndUserIdAndOccurredAtBetween(
            Long challengeId, String userId, Instant start, Instant end);

    Optional<ChallengeCheckIn> findByChallengeIdAndUserIdAndOccurredAtBetween(
            Long challengeId, String userId, Instant start, Instant end);

    long countByChallengeIdAndUserId(Long challengeId, String userId);
}
