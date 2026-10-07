package com.habituate.api.coach;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AnthropicResponse(
        String id,
        String role,
        List<AnthropicContentBlock> content,
        @JsonProperty("stop_reason") String stopReason
) {
}
