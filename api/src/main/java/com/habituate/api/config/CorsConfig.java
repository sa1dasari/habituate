package com.habituate.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * CORS only matters for the Expo web preview (dev convenience, not the
 * acceptance target per CLAUDE.md) — the native app's fetch calls aren't
 * subject to it. A wildcard origin here let any third-party site's JS call
 * every /api/** endpoint, including sending an Authorization header, since
 * nothing else in the stack blocks a cross-origin browser request. Scoped to
 * localhost so only the local web dev server can call the API cross-origin.
 *
 * Exposed as a CorsConfigurationSource bean (wired into SecurityConfig's
 * HttpSecurity.cors()) rather than a WebMvcConfigurer — Spring Security's
 * filter chain intercepts preflight requests before they'd reach an MVC-level
 * addCorsMappings() registration, so that approach let /api/health's CORS
 * preflight succeed while every other /api/** path came back "Invalid CORS
 * request" regardless of origin.
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("http://localhost:*", "http://127.0.0.1:*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "Authorization", "X-Timezone"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
