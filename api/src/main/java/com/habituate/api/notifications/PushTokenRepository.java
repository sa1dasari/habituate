package com.habituate.api.notifications;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushTokenRepository extends JpaRepository<PushToken, Long> {
    Optional<PushToken> findByToken(String token);

    List<PushToken> findByUserId(String userId);

    void deleteByToken(String token);
}
