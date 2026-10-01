package com.habituate.api.insights;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Plain scheduled task, no Flink — Phase 5's "simple, batch" insights engine.
 * Phase 6 replaces this with an event-triggered Flink job over the same
 * checkin-events topic; this class goes away then, not the correlation math
 * it calls (CorrelationEngine/InsightService stay).
 */
@Component
public class InsightScheduler {

    private static final Logger log = LoggerFactory.getLogger(InsightScheduler.class);

    private final InsightService insightService;

    public InsightScheduler(InsightService insightService) {
        this.insightService = insightService;
    }

    @Scheduled(cron = "0 0 3 * * *")
    public void runNightly() {
        log.info("Running nightly insight computation for all active users");
        insightService.computeForAllUsers();
    }
}
