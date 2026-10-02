package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {
    Optional<Friendship> findByRequesterIdAndRecipientId(String requesterId, String recipientId);

    List<Friendship> findByRequesterIdAndStatus(String requesterId, String status);

    List<Friendship> findByRecipientIdAndStatus(String recipientId, String status);
}
