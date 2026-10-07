package com.habituate.api.coach;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.Map;

/**
 * One block of an Anthropic Messages API response. type is "text" (text
 * populated) or "tool_use" (name/input populated, id is the tool-call id —
 * unused here since this app always resolves the tool call in the same
 * request/response round trip, never across turns).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AnthropicContentBlock(String type, String text, String id, String name, Map<String, Object> input) {
}
