package com.habituate.api.groups;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateFriendRequest(@NotBlank @Size(max = 254) @Email String email) {
}
