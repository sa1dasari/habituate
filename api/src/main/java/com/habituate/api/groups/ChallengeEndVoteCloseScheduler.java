package com.habituate.api.groups;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Closes any ChallengeEndVote still open past its 24-hour closesAt — a vote
 * that reaches majority closes immediately inside ChallengeEndVoteService.respond,
 * so anything this sweep finds, by definition, never reached one. FAILED is
 * the only outcome this ever sets.
 */
@Component
public class ChallengeEndVoteCloseScheduler {

    private static final Logger log = LoggerFactory.getLogger(ChallengeEndVoteCloseScheduler.class);

    private final ChallengeEndVoteRepository voteRepository;
    private final ChallengeEndVoteService voteService;

    public ChallengeEndVoteCloseScheduler(ChallengeEndVoteRepository voteRepository, ChallengeEndVoteService voteService) {
        this.voteRepository = voteRepository;
        this.voteService = voteService;
    }

    @Scheduled(cron = "0 * * * * *")
    public void sweep() {
        closeExpired(Instant.now());
    }

    /** Public so a test can drive it with a fixed Instant instead of waiting on the cron/clock. */
    public void closeExpired(Instant now) {
        List<ChallengeEndVote> expired = voteRepository.findByOutcomeIsNullAndClosesAtLessThanEqual(now);
        for (ChallengeEndVote vote : expired) {
            voteService.closeAsFailed(vote, now);
        }
        if (!expired.isEmpty()) {
            log.info("Closed {} expired challenge end-vote(s) as failed", expired.size());
        }
    }
}
