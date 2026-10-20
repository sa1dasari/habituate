package com.habituate.api.groups;

import jakarta.validation.constraints.NotNull;

/** habitId: which of the accepting member's own habits to link to the group. */
public record AcceptGroupInviteRequest(@NotNull Long habitId) {
}
