package com.habituate.api.billing;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RevenueCatWebhookRequest(
        @JsonProperty("api_version") String apiVersion,
        @JsonProperty("event") RevenueCatWebhookEvent event
) {
}
