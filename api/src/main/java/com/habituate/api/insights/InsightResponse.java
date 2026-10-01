package com.habituate.api.insights;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public record InsightResponse(Long id, String type, Instant generatedAt, Map<String, Object> payload) {

    @SuppressWarnings("unchecked")
    public static InsightResponse from(Insight insight, ObjectMapper mapper) {
        Map<String, Object> parsedPayload;
        try {
            parsedPayload = mapper.readValue(insight.getPayload(), Map.class);
        } catch (JsonProcessingException e) {
            // Defensive only — InsightService always writes valid JSON itself.
            parsedPayload = new LinkedHashMap<>();
        }
        return new InsightResponse(insight.getId(), insight.getType(), insight.getGeneratedAt(), parsedPayload);
    }
}
