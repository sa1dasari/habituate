package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChallengeEndVoteResponseRepository extends JpaRepository<ChallengeEndVoteResponse, Long> {
    List<ChallengeEndVoteResponse> findByVoteId(Long voteId);

    Optional<ChallengeEndVoteResponse> findByVoteIdAndUserId(Long voteId, String userId);

    boolean existsByVoteIdAndUserId(Long voteId, String userId);

    long countByVoteIdAndResponse(Long voteId, String response);
}
