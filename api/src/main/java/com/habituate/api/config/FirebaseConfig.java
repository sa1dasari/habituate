package com.habituate.api.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    /**
     * Path to the Firebase service-account JSON file.
     * Set via FIREBASE_SERVICE_ACCOUNT_PATH env var or application.properties.
     * If not set, Firebase token verification is skipped and the app falls back
     * to demo-user mode (development only — never deploy without this set).
     */
    @Value("${firebase.service-account-path:}")
    private String serviceAccountPath;

    @PostConstruct
    public void init() {
        if (FirebaseApp.getApps().isEmpty()) {
            if (serviceAccountPath == null || serviceAccountPath.isBlank()) {
                log.warn("FIREBASE_SERVICE_ACCOUNT_PATH not set — running in demo mode (no token verification). " +
                         "Set firebase.service-account-path in application.properties or the env var before deploying.");
                return;
            }

            try (InputStream serviceAccount = new FileInputStream(serviceAccountPath)) {
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();
                FirebaseApp.initializeApp(options);
                log.info("Firebase Admin SDK initialised from {}", serviceAccountPath);
            } catch (IOException e) {
                throw new IllegalStateException(
                        "Failed to load Firebase service account from: " + serviceAccountPath, e);
            }
        }
    }
}
