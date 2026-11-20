package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ChallengeEndVoteRepository extends JpaRepository<ChallengeEndVote, Long> {
    Optional<ChallengeEndVote> findFirstByChallengeIdOrderByOpenedAtDesc(Long challengeId);

    List<ChallengeEndVote> findByOutcomeIsNullAndClosesAtLessThanEqual(Instant now);
}
