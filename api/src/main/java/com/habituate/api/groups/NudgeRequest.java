package com.habituate.api.groups;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NudgeRequest(@NotBlank @Size(max = 128) String targetUserId) {
}
