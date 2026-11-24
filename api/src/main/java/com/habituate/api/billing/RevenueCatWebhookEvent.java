package com.habituate.api.billing;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** RevenueCat's webhook event shape is snake_case; only the fields this
 * backend actually reads are modeled, the rest fall through @JsonIgnoreProperties. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RevenueCatWebhookEvent(
        @JsonProperty("type") String type,
        @JsonProperty("app_user_id") String appUserId,
        @JsonProperty("original_app_user_id") String originalAppUserId,
        @JsonProperty("aliases") List<String> aliases,
        @JsonProperty("entitlement_ids") List<String> entitlementIds
) {
}
