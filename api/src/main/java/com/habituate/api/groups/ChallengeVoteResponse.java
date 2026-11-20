package com.habituate.api.groups;

import java.time.Instant;

/**
 * Live state of one end-early vote — yesCount/totalEligible/myResponse are
 * always computed from the current response rows, never stored, so "You
 * voted yes" reflects reality even if the viewer last saw this vote from a
 * notification that's since gone stale (board 66/67/69's own reasoning,
 * see the design-review thread).
 */
public record ChallengeVoteResponse(
        Long id,
        Long challengeId,
        String proposedBy,
        String proposedByName,
        Instant openedAt,
        Instant closesAt,
        String outcome,
        int yesCount,
        int totalEligible,
        String myResponse,
        boolean eligible,
        boolean canVote
) {
}
