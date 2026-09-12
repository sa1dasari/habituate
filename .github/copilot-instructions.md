# Copilot Instructions for Habituate

## Build, test, and validation commands

### Local infrastructure
- Start Postgres, Zookeeper, and Kafka: `docker compose up -d`

### Backend (Spring Boot)
- Run the API: `cd api && ./mvnw spring-boot:run`
- Run the full Java test suite: `cd api && ./mvnw test`
- Run a single test class: `cd api && ./mvnw -Dtest=HabituateApiApplicationTests test`
- If a focused test is needed for a specific class or method, use Maven's `-Dtest` selector with the class name or method name pattern.
- There is no dedicated lint command configured in the Maven project right now.

### Mobile (Expo / React Native)
- Start the app: `cd mobile && npx expo start`
- Platform-specific starts: `cd mobile && npx expo start --android` or `cd mobile && npx expo start --ios`
- Web: `cd mobile && npx expo start --web`
- There is no test or lint script configured in `mobile/package.json` yet, so smoke testing is the current validation path.

### Smoke-check flow used by this repo
- API health check endpoint: `GET /api/health`
- Mobile app expects the backend on `http://localhost:8080` on device/emulator-specific hosts, with Android using `http://10.0.2.2:8080`.

## High-level architecture

This repository is split into three main runtime areas:

- `mobile/`: React Native app built with Expo. The app is the client surface for habits, goals, insights, and group flows.
- `api/`: Spring Boot backend that owns the REST API, persistence, and Kafka publication for check-ins.
- `streaming/`: Flink jobs for the correlation/insight pipeline.
- `infra/`: Terraform and local Docker Compose configuration for the data and event infrastructure.

The repo intentionally follows this flow:

- Write path: Mobile app → Spring Boot API → Postgres (source of truth) + Kafka topic `checkin-events`
- Insight path: Kafka `checkin-events` → Flink correlation job → insights store → mobile notifications / API serving

The important architectural rule is that every check-in is both stored in Postgres and emitted to Kafka in the same request path; the app is designed around that event-driven insight engine rather than a purely batch approach.

## Key conventions

### Project scope and delivery order
- Follow the active phase in `SKILLS.md` and do not pull in features from later phases without updating that file first.
- The repo is intentionally structured around phased delivery; keep changes scoped to the current phase unless a direct dependency requires otherwise.

### Backend conventions
- Package by feature, not by technical layer (for example `habits`, `checkins`, `insights`, `groups`).
- Keep REST controllers thin; business logic and Kafka publishing belong in the service layer.
- DTOs are for API boundaries; do not expose JPA entities directly.
- Any write that should trigger an event must publish the Kafka event inside the service layer, not in the controller.
- The current backend skeleton already uses `com.habituate.api.health.HealthController`, with an `@GetMapping("/api/health")` endpoint.

### Mobile conventions
- Keep screen components thin; move business logic into hooks or shared state modules.
- Use functional React components and hooks, not class components.
- For this repo, mobile API calls are expected to be centralized rather than scattered across screens.
- The app boot check currently targets the backend health endpoint and keeps the app in a loading/error state until the API responds.

### Product and UX conventions
- Anti-guilt UX is a project-specific requirement, not a stylistic preference: no red X states, no shaming copy, and streak freezes must exist before any streak-pressure mechanics ship.
- Shared/group habits and correlations are first-class product features; avoid turning this into a generic to-do tracker.

### Data model and domain language
- The canonical domain vocabulary is defined in `CLAUDE.md`: users, habits, check_ins, goals, correlations, insights, friendships, groups, and group streaks.
- When adding code or schema, match the project language around habitual tracking, shared streaks, and correlation-driven insights.

## Working style for this repo

- Prefer the smallest direct validation path: a backend startup check or a single Maven test for Java changes, and the Expo app startup for mobile changes.
- When you add or change project behavior, keep the matching documentation updated in the relevant repo docs (`README.md`, `SKILLS.md`, or the app-specific `CLAUDE.md` files) if the change affects project structure or scope.
- Keep assistant instructions aligned with the real project state; the current build is intentionally early-stage and phase-based.
