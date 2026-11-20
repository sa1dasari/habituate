package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChallengeEndVoteBallotRepository extends JpaRepository<ChallengeEndVoteBallot, Long> {
    List<ChallengeEndVoteBallot> findByVoteId(Long voteId);

    Optional<ChallengeEndVoteBallot> findByVoteIdAndUserId(Long voteId, String userId);

    boolean existsByVoteIdAndUserId(Long voteId, String userId);

    long countByVoteIdAndResponse(Long voteId, String response);
}
