package com.habituate.api.notifications;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PushTokenService {

    private final PushTokenRepository pushTokenRepository;

    public PushTokenService(PushTokenRepository pushTokenRepository) {
        this.pushTokenRepository = pushTokenRepository;
    }

    /**
     * Upsert by token, not by (userId, token) — the same device's token can
     * legitimately move to a different account (sign-out/sign-in as someone
     * else on the same phone), and a token is unique to the install.
     */
    @Transactional
    public void register(String userId, String token, String platform) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("token is required");
        }
        PushToken existing = pushTokenRepository.findByToken(token).orElse(null);
        if (existing == null) {
            pushTokenRepository.save(new PushToken(userId, token, platform));
            return;
        }
        existing.setUserId(userId);
        existing.setPlatform(platform);
        pushTokenRepository.save(existing);
    }

    @Transactional
    public void unregister(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        pushTokenRepository.deleteByToken(token);
    }
}
