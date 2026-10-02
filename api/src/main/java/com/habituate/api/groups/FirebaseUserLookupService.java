package com.habituate.api.groups;

import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class FirebaseUserLookupService implements UserLookupService {

    @Override
    public Optional<UserProfile> findByEmail(String email) {
        try {
            UserRecord record = FirebaseAuth.getInstance().getUserByEmail(email.trim());
            return Optional.of(toProfile(record));
        } catch (FirebaseAuthException e) {
            if (e.getAuthErrorCode() == AuthErrorCode.USER_NOT_FOUND) {
                return Optional.empty();
            }
            throw new IllegalStateException("Could not look up user by email", e);
        }
    }

    @Override
    public UserProfile resolve(String uid) {
        try {
            return toProfile(FirebaseAuth.getInstance().getUser(uid));
        } catch (Exception e) {
            return new UserProfile(uid, uid, null);
        }
    }

    private UserProfile toProfile(UserRecord record) {
        String name = (record.getDisplayName() != null && !record.getDisplayName().isBlank())
                ? record.getDisplayName()
                : (record.getEmail() != null ? record.getEmail() : record.getUid());
        return new UserProfile(record.getUid(), name, record.getEmail());
    }
}
