package com.habituate.api.groups;

public record GroupInviteResponse(Long groupId, String groupName, String invitedBy, String streakRule) {
}
