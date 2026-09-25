package com.habituate.api.events;

import com.habituate.api.checkins.CheckIn;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Publishes to `checkin-events` in the same request as the Postgres write
 * (see CLAUDE.md: "Postgres write and Kafka publish must not drift — if one
 * fails, the request fails"). The send is awaited with a short timeout so a
 * broker outage surfaces as a failed API request instead of silently
 * dropping the event — this isn't a full transactional outbox (the Postgres
 * write can't be rolled back once committed), just a best-effort v1; revisit
 * with an outbox table if dual-write drift becomes a real problem.
 */
@Component
public class CheckInEventPublisher {

    private static final long SEND_TIMEOUT_SECONDS = 5;

    private final KafkaTemplate<String, CheckInEvent> kafkaTemplate;

    public CheckInEventPublisher(KafkaTemplate<String, CheckInEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishCreated(CheckIn checkIn) {
        publish(CheckInEvent.CREATED, checkIn);
    }

    public void publishDeleted(CheckIn checkIn) {
        publish(CheckInEvent.DELETED, checkIn);
    }

    private void publish(String eventType, CheckIn checkIn) {
        CheckInEvent event = new CheckInEvent(
                eventType,
                checkIn.getId(),
                checkIn.getHabitId(),
                checkIn.getUserId(),
                checkIn.getOccurredAt(),
                checkIn.getValue(),
                checkIn.getSource(),
                Instant.now()
        );

        try {
            kafkaTemplate.send(KafkaTopicConfig.CHECKIN_EVENTS_TOPIC, checkIn.getUserId(), event)
                    .get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted publishing check-in event", e);
        } catch (ExecutionException | TimeoutException e) {
            throw new IllegalStateException("Failed to publish check-in event to Kafka", e);
        }
    }
}
