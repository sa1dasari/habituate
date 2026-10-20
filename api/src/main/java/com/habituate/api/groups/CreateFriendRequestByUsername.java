package com.habituate.api.groups;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateFriendRequestByUsername(@NotBlank @Size(min = 3, max = 20) String username) {
}
