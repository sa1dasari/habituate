# Habituate

A habit tracker that goes beyond checkmarks — it finds the patterns between your habits, lets you build streaks with friends, and turns your data into a shareable yearly recap.

## Why this exists

Most habit trackers are glorified checklists: log a habit, get a streak number, feel guilty when it breaks. Habituate is built around three ideas that most trackers skip:

1. **Correlation over checkmarks.** A real-time engine surfaces relationships between your habits (e.g. "you're 3x more likely to hit your step goal on days you read first").
2. **Shared accountability.** Habits can be tracked solo or as a group — Snapchat-style streaks, but for things that actually matter.
3. **Anti-guilt design.** No red X's for missed days. Trend framing over perfection framing. Streak freezes instead of all-or-nothing pressure.

## Features

### Core tracking
- Habit CRUD with daily / weekly / monthly cadence
- Check-in logging (boolean or numeric)
- Non-punitive streaks (current + longest, with freeze tokens)
- Calendar grid view per habit
- Push reminders

### Insights engine
- Real-time pairwise habit correlation (Kafka + Flink)
- Streak-risk prediction
- Weekly digest of patterns

### Goals
- Freeform weekly/monthly goals, independent of a single habit
- Progress tracking toward monthly targets

### Social
- Friends and groups
- Shared habits with group streaks (all-members or any-member rules)
- Group activity feed

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

## Build order

See `SKILLS.md` for the phased build plan — start there, work top to bottom.

## Status

Early build. Core tracking in progress.
