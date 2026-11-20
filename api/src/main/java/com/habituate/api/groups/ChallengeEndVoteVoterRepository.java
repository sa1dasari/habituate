package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChallengeEndVoteVoterRepository extends JpaRepository<ChallengeEndVoteVoter, Long> {
    List<ChallengeEndVoteVoter> findByVoteId(Long voteId);

    boolean existsByVoteIdAndUserId(Long voteId, String userId);
}
