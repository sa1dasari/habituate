package com.habituate.api.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Phase 4's "basic consumer that just logs events, to confirm the pipe
 * works" (SKILLS.md). Superseded by the real Flink job in Phase 6, which
 * will maintain rolling per-habit completion state instead of just logging.
 */
@Component
public class CheckInEventLogger {

    private static final Logger log = LoggerFactory.getLogger(CheckInEventLogger.class);

    @KafkaListener(topics = KafkaTopicConfig.CHECKIN_EVENTS_TOPIC)
    public void onCheckInEvent(CheckInEvent event) {
        log.info("checkin-event received: {}", event);
    }
}
