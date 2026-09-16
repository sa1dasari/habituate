# Habituate

A habit tracker that goes beyond checkmarks — it finds the patterns between your habits, lets you build streaks with friends, and turns your data into a shareable yearly recap.

## Why this exists

Most habit trackers are glorified checklists: log a habit, get a streak number, feel guilty when it breaks. Habituate is built around three ideas that most trackers skip:

1. **Correlation over checkmarks.** A real-time engine surfaces relationships between your habits (e.g. "you complete Morning Walk 90% of the time on days you also complete Morning Coffee"), framed honestly as conditional probability — never as a causal claim.
2. **Shared accountability.** Habits can be tracked solo or as a group — Snapchat-style streaks, but for things that actually matter, with a visible rule for what keeps the streak alive.
3. **Anti-guilt design.** No red X's for missed days. Trend framing over perfection framing. Streak freezes instead of all-or-nothing pressure.

## Features

### Core tracking
- Habit CRUD with daily / weekly / monthly cadence
- Check-in logging (boolean or numeric)
- Non-punitive streaks (current + longest, with freeze tokens)
- Calendar grid view per habit
- Push reminders

### Insights
- Weekly/monthly/yearly consistency view (completion ring, trend delta)
- "Pattern detected" cards: pairwise habit correlation shown as a directional relationship (Habit A → Habit B) with a match percentage and plain-language description
- Correlation copy is always phrased as conditional frequency ("X% of the time"), never as causation
- Evidence-based nudge attached to each pattern, suggesting a concrete action based on the detected relationship
- Streak-risk prediction

### Goals
- Freeform weekly/monthly goals, independent of a single habit
- Progress tracking toward monthly targets

### Community (social)
- **Shared Habits** — a habit tracked jointly by 2+ people, with its own group streak, a visible streak rule (all members / any member), and a distinct visual state for "streak at risk" vs. "safe" vs. "frozen" (grace token used)
- **Challenges** — separate from Shared Habits; a time-boxed, multi-person goal with its own progress bar, not tied to daily streak mechanics
- Friend activity feed

### Habituate Wrapped
- Monthly and annual auto-generated recap
- Shareable image cards

## Tech stack

| Layer | Choice |
|---|---|
| Mobile | React Native (Expo) |
| Backend API | Spring Boot (Java) |
| Database | PostgreSQL |
| Event streaming | Kafka |
| Stream processing | Apache Flink |
| Auth | Firebase Auth |
| Push notifications | Firebase Cloud Messaging |
| Infra | Docker Compose (local), Terraform + AWS (ECS Fargate, RDS, MSK) |

## Architecture

Two flows:

- **Write path:** Mobile app → Spring Boot API → Postgres (source of truth) + Kafka (`checkin-events`)
- **Insight path:** Kafka (`checkin-events`) → Flink job (windowed correlation) → Insights store → push notification back to mobile

Full data model and diagrams live in `CLAUDE.md`.

## Repo structure

```
/mobile        React Native app
/api           Spring Boot service
/streaming     Flink jobs
/infra         Terraform + Docker Compose
CLAUDE.md      Architecture, conventions, and build context for AI-assisted development
SKILLS.md      Step-by-step build order and phase checklist
README.md      This file
```

## Getting started

```bash
# clone and set up local infra
docker compose up -d        # postgres, kafka, zookeeper

# backend
cd api && ./mvnw spring-boot:run

# mobile
cd mobile && npx expo start
```

### Running on a physical phone (Expo Go)

The mobile client derives the API host from Expo's manifest (`Constants.expoConfig.hostUri`,
with the Metro bundle URL as a fallback), so on a real device it calls
`http://<your-dev-machine-LAN-IP>:8080` automatically — no code edit needed. The
resolved address is logged on startup as `[habituate] API base URL: …`, which is the
first thing to check when a request fails.

Two things still have to be true:

1. Phone and dev machine are on the same Wi-Fi network, and Metro is running in LAN
   mode (the default — not `--localhost`, not `--tunnel`).
2. Windows Firewall allows inbound TCP 8080 for the JDK running the API. If requests
   time out while Metro still loads fine, add an explicit rule from an **admin** PowerShell:

   ```powershell
   New-NetFirewallRule -DisplayName "Habituate API 8080 (dev)" -Direction Inbound `
     -Protocol TCP -LocalPort 8080 -Action Allow -Profile Any
   ```

To point the app at a different host (tunnel, staging, USB/`adb reverse`), either set
`EXPO_PUBLIC_API_URL` before starting Metro:

```bash
EXPO_PUBLIC_API_URL=http://10.0.0.5:8080 npx expo start
```

or add `expo.extra.apiUrl` in `mobile/app.json`. Both take precedence over auto-detection.

## Build order

See `SKILLS.md` for the phased build plan — start there, work top to bottom.

## Status

Early build. Core tracking in progress. Insights and Community screen designs finalized (v1) — see `CLAUDE.md` for UI conventions.
