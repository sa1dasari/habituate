package com.habituate.api.groups;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InviteToGroupRequest(@NotBlank @Size(max = 128) String friendUserId) {
}
