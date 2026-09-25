package com.habituate.api.events;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {

    public static final String CHECKIN_EVENTS_TOPIC = "checkin-events";

    /** Single partition is plenty at this scale; Kafka's own auto-create would do the
     * same, but declaring it explicitly documents the topic as part of the app. */
    @Bean
    public NewTopic checkinEventsTopic() {
        return TopicBuilder.name(CHECKIN_EVENTS_TOPIC)
                .partitions(1)
                .replicas(1)
                .build();
    }
}
