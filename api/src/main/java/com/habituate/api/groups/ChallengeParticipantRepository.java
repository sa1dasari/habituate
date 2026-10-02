package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChallengeParticipantRepository extends JpaRepository<ChallengeParticipant, Long> {
    Optional<ChallengeParticipant> findByChallengeIdAndUserId(Long challengeId, String userId);

    List<ChallengeParticipant> findByChallengeId(Long challengeId);

    List<ChallengeParticipant> findByUserId(String userId);
}
