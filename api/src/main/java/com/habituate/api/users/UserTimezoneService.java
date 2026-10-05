package com.habituate.api.users;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;

@Service
public class UserTimezoneService {

    private final UserRepository userRepository;

    public UserTimezoneService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Called opportunistically off every authenticated request's X-Timezone
     * header (see FirebaseAuthFilter) — never a dedicated endpoint. A no-op
     * when the header is absent/unparseable or already matches what's
     * stored, so this stays a cheap no-write path on the common case.
     */
    @Transactional
    public void recordTimezone(String userId, String timezone) {
        if (userId == null || timezone == null || timezone.isBlank()) {
            return;
        }
        String trimmed = timezone.trim();
        try {
            ZoneId.of(trimmed);
        } catch (DateTimeException ex) {
            return;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            userRepository.save(new User(userId, trimmed));
            return;
        }
        if (!trimmed.equals(user.getTimezone())) {
            user.setTimezone(trimmed);
            user.setUpdatedAt(Instant.now());
            userRepository.save(user);
        }
    }
}
