package com.habituate.api.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    /**
     * Path to the Firebase service-account JSON file — the local-dev shape,
     * since a literal filesystem path only makes sense on a machine you
     * control. Set via FIREBASE_SERVICE_ACCOUNT_PATH or application.properties.
     */
    @Value("${firebase.service-account-path:}")
    private String serviceAccountPath;

    /**
     * The service-account JSON's raw content — the deployed-host shape
     * (Railway, etc.), since there's no persistent file to point a path at
     * on an ephemeral container. Set via FIREBASE_SERVICE_ACCOUNT_JSON (paste
     * the whole key file's contents as one env var value). Takes priority
     * over the path when both are set, since a deployed host has no
     * meaningful local path anyway.
     *
     * If neither is set, Firebase token verification is skipped and the app
     * falls back to demo-user mode (development only — never deploy without
     * one of these set).
     */
    @Value("${firebase.service-account-json:}")
    private String serviceAccountJson;

    @PostConstruct
    public void init() {
        if (FirebaseApp.getApps().isEmpty()) {
            if (serviceAccountJson != null && !serviceAccountJson.isBlank()) {
                try (InputStream serviceAccount =
                             new ByteArrayInputStream(serviceAccountJson.getBytes(StandardCharsets.UTF_8))) {
                    FirebaseOptions options = FirebaseOptions.builder()
                            .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                            .build();
                    FirebaseApp.initializeApp(options);
                    log.info("Firebase Admin SDK initialised from FIREBASE_SERVICE_ACCOUNT_JSON");
                } catch (IOException e) {
                    throw new IllegalStateException("Failed to load Firebase service account from FIREBASE_SERVICE_ACCOUNT_JSON", e);
                }
                return;
            }

            if (serviceAccountPath == null || serviceAccountPath.isBlank()) {
                log.warn("Neither FIREBASE_SERVICE_ACCOUNT_JSON nor FIREBASE_SERVICE_ACCOUNT_PATH is set — running in demo mode (no token verification). " +
                         "Set one of them before deploying.");
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
