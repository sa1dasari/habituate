package com.habituate.api.coach;

import com.habituate.api.common.CoachUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Thin wrapper around Anthropic's Messages API (https://api.anthropic.com/v1/messages),
 * called directly over HTTP rather than via the Anthropic Java SDK — one fewer
 * dependency to pin a version for, and this app only ever needs this one
 * endpoint. Responses are generated server-side on purpose (CLAUDE.md /
 * SKILLS.md Phase 10): the API key never reaches the mobile client.
 */
@Component
public class AnthropicClient {

    private static final String MODEL = "claude-sonnet-5";
    private static final String ANTHROPIC_VERSION = "2023-06-01";
    private static final int MAX_TOKENS = 1024;

    private final RestClient restClient;
    private final String apiKey;

    public AnthropicClient(@Value("${anthropic.api-key:${ANTHROPIC_API_KEY:}}") String apiKey) {
        this.apiKey = apiKey;
        this.restClient = RestClient.builder()
                .baseUrl("https://api.anthropic.com/v1")
                .build();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public AnthropicResponse sendMessage(String system, List<Map<String, Object>> messages, List<Map<String, Object>> tools) {
        if (!isConfigured()) {
            throw new CoachUnavailableException("Ask Habituate isn't configured yet (missing Anthropic API key).");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", MODEL);
        body.put("max_tokens", MAX_TOKENS);
        body.put("system", system);
        body.put("messages", messages);
        if (tools != null && !tools.isEmpty()) {
            body.put("tools", tools);
        }

        try {
            return restClient.post()
                    .uri("/messages")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", ANTHROPIC_VERSION)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(AnthropicResponse.class);
        } catch (RestClientException ex) {
            throw new CoachUnavailableException("Ask Habituate couldn't reach the AI service right now — try again in a moment.");
        }
    }
}
