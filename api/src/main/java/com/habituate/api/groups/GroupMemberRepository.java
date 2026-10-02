package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    Optional<GroupMember> findByGroupIdAndUserId(Long groupId, String userId);

    List<GroupMember> findByGroupId(Long groupId);

    List<GroupMember> findByGroupIdAndStatus(Long groupId, String status);

    List<GroupMember> findByUserIdAndStatus(String userId, String status);

    /** Looked up by HabitService.createCheckIn to tag a check-in with groupId when its habit is group-linked. */
    Optional<GroupMember> findByHabitIdAndStatus(Long habitId, String status);
}
