# CLAUDE.md

Standing instructions for any AI assistant working in this repo. Read this first. Keep it short and current. It holds rules and facts, not progress logs. Progress lives in `SKILLS.md`. Long-form rationale and the full data model live in `docs/background.md`.

## 1. Project overview

Habituate is a habit tracker for iOS and Android. The main flow: a user opens the Today tab, taps a habit to check in, the API writes the check-in to Postgres and publishes it to Kafka, and personal streaks, group streaks and the friend activity feed update from there. Users can also ask "Ask Habituate", an AI coach that answers from their own check-in stats and can propose changes they must confirm.

Three things set it apart from generic trackers:
1. An AI coach grounded in real check-in data, not a generic chatbot.
2. Shared Habits with group streaks and an explicit streak rule (all members or any member).
3. Anti-guilt design: no punishing visuals, streak freezes, trend framing.

Core goals, in priority order:
1. Ship the active phase in `SKILLS.md`. Do not add features outside it without updating that file first. This is a solo build and scope creep is the main risk.
2. Reach a real Play Store and App Store release. Pick store-compatible, scale-sane options over quick shortcuts.
3. Keep the product rules below true everywhere.

Phases 0 to 8.5 and 10 are done. Phase 9 (production readiness) is the open gate. Confirm the real state in `SKILLS.md` instead of trusting this line.

### Product rules (non-negotiable)
- No red X for missed days anywhere. No shaming copy. Use trend framing, not perfection framing.
- A streak freeze needs its own visual state before any streak-pressure feature ships.
- Coach and any insight copy stays non-causal and tied to real data: "you complete Y on X% of the days you complete X", never "X causes Y". `CoachPrompts` enforces this in the system prompt.
- The coach never changes data on its own. A proposal only takes effect when the user confirms (`CoachService.confirmProposal`).
- Shared Habits and Challenges are separate in the data model and the UI. Do not merge them.
- Groups reuse the `checkin-events` stream as filtered consumers. Do not build a parallel pipeline.
- Another user's data is readable only through friendship-gated endpoints. Profiles default to PRIVATE.
- Design first, mobile first. `design/*.png` is the UI spec. Target 360 to 430dp widths and 44dp touch targets. Expo web is a dev preview only, never the acceptance target.

## 2. Tech stack

### Mobile (`mobile/`)
- Expo SDK 57 (`expo ~57.0.21`), React Native 0.86.3, React 19.2.3, New Architecture. Package manager: npm.
- JavaScript with functional components and hooks. TypeScript only where it already exists (`mobile/widgets/HabitWidget.tsx`).
- React Navigation 7 (bottom tabs plus native stack), `firebase` JS SDK ^10.14.1, `react-native-reanimated` 4, `react-native-gesture-handler` 3, `react-native-svg`, `expo-linear-gradient`, Nunito via `@expo-google-fonts/nunito`.
- Native pieces: `expo-dev-client`, `@bacons/apple-targets` (iOS widget), `react-native-android-widget`, `react-native-shared-group-preferences`, Google Sign-In, Facebook SDK, Apple authentication.
- Before writing Expo code, read the v57 docs: https://docs.expo.dev/versions/v57.0.0/ (also in `mobile/AGENTS.md`).

### Backend (`api/`)
- Java 21, Spring Boot 3.3.3, Maven wrapper (`./mvnw`).
- Spring Web, Data JPA (Hibernate), Validation, Security, Actuator, Mail, `spring-kafka`, `firebase-admin` 9.4.1.
- Coach: Anthropic Messages API called with `RestClient` (no SDK) in `AnthropicClient`, model `claude-sonnet-5`, server side only.
- Schema comes from `spring.jpa.hibernate.ddl-auto=update`. There are no migrations yet (Flyway is a Phase 9 item).

### Data and services
- Postgres 16 (docker `postgres:16-alpine`), Kafka and Zookeeper (Confluent 7.6.1), topic `checkin-events` (1 partition, 1 replica in dev).
- Firebase Auth (email/password, Google, Facebook, Apple). The backend verifies the ID token on every request in `FirebaseAuthFilter`.
- Push goes through Expo's push service, not FCM directly. Photos and feedback attachments upload from the client straight to Firebase Storage.
- Hosting: the API appears to run on Railway today (`PORT` placeholder in `application.properties`, `EXPO_PUBLIC_API_URL` in `mobile/eas.json`). Terraform on AWS (ECS Fargate, RDS, MSK) is the Phase 9 plan. `infra/` and `streaming/` are empty placeholders. There is no Flink.

### Do not
- Do not add Redux or another state library. Use hooks and the existing providers.
- Do not use GraphQL (REST only for v1) or class components. Do not treat the Expo web preview as a deliverable.
- Do not call Anthropic from the mobile app or put an API key in the client.
- Do not expose JPA entities from controllers. Do not accept a client-supplied user ID. Read `userId` from the request attribute set by `FirebaseAuthFilter`.
- Do not add Flink, a second event pipeline, or a Kafka consumer that is not a filtered consumer of `checkin-events` with its own consumer group id.
- Do not add a native module, run `expo prebuild` and commit `ios/` or `android/`, or add any dependency without asking. The home-screen widgets are the one approved exception to staying managed-workflow friendly.
- Do not set `fontWeight` together with a Nunito `fontFamily`. Do not import `colors`, `typography` or `streakStates` from `theme.js` inside components. Do not use a plain `fire` icon or flat progress-bar colors. See section 4.

## 3. Commands

The author works on Windows. Use `./mvnw` in bash and `mvnw.cmd` in PowerShell.

```bash
# Local infra: postgres :5432, kafka :9092, zookeeper, pgadmin :5050, kafka-ui :8082
docker compose up -d

# Backend
cd api && ./mvnw spring-boot:run          # API on :8080 (or $PORT)
curl localhost:8080/api/health            # {"service":"habituate-api","status":"ok"}
cd api && ./mvnw test                     # full suite
cd api && ./mvnw -Dtest=ClassName test    # one class
cd api && ./mvnw -q compile               # fast compile check

# Mobile
cd mobile && npm install
cd mobile && npx expo start               # dev server (LAN mode so a phone can reach the API)
cd mobile && npx expo install <package>   # always use this to add or pin Expo-managed packages
cd mobile && npx expo export --platform web   # bundle check used in this repo
cd mobile && npx tsc --noEmit             # only matters when .ts or .tsx files change
eas build --profile development --platform android|ios   # custom dev client (run from mobile/)
```

Notes:
- There is no mobile test script and no lint script in either project. Do not invent one. Do not claim lint passed.
- Test on an EAS development client. Expo Go cannot load the widget targets or the native Google and Facebook sign-in modules.
- To point the app at another API host, set `EXPO_PUBLIC_API_URL` before `expo start` (or in `mobile/.env.local`, which already points development builds at the Railway production API — see §2).
- `eas build` costs build minutes and `./mvnw test` writes to the dev database (see section 5). Both are fine when the task needs them. Say so before running them.

## 4. Architecture and directory map

### Write path
Mobile app, then Spring Boot API, then Postgres (source of truth) and a Kafka event on `checkin-events`, in the same request. If either fails, the request fails. The check-in write in `HabitService` is `@Transactional`. Kafka publishing happens in the service layer, never the controller.

### Backend layout: `api/src/main/java/com/habituate/api/`
Package by feature. Each feature owns its controller, service, repository, entities and DTOs.

| Package | Owns |
|---|---|
| `habits` | habit CRUD, check-ins, `StreakCalculator`, shield awards, personal freeze scheduler |
| `checkins` | check-in entity, repository, request and response DTOs |
| `goals` | freeform goals, period progress and rollover |
| `groups` | friendships, shared habits, group streaks, challenges, activity feed, cheers |
| `coach` | Ask Habituate: context builder, prompts, Anthropic client, proposals, reactions |
| `notifications` | in-app notifications, Expo push, reminder and period-summary schedulers |
| `users` | profile, username, timezone, visibility, friend profile, account deletion |
| `feedback` | bug and suggestion reports, email notification |
| `events` | Kafka topic config, publisher, logger consumer |
| `config` | Firebase, security, CORS, `FirebaseAuthFilter` |
| `common` | shared exceptions and `GlobalExceptionHandler` |
| `health` | `GET /api/health` |

Placement rules:
- Controllers stay thin. Business logic, ownership checks and Kafka publishing go in services.
- Keep pure logic separate from Spring so it is easy to test (`StreakCalculator`, `GroupStreakEngine`).
- DTOs named `*Request` and `*Response` sit at the API boundary.
- Scheduled jobs live in the feature package they serve.
- Day bucketing uses the `X-Timezone` request header. Scheduled jobs use the stored `users.timezone`, or UTC when there is none.
- Cross-user reads must go through `FriendshipService.areFriends` or an equivalent membership check. Re-derive ownership from the stored row, never from the caller's input.
- Entity changes alter the dev schema automatically. A removed column or table is not dropped for you. Ask before dropping anything.
- Errors go through `GlobalExceptionHandler` as `{"error": "..."}` with a specific, user-facing message — never a generic one. The mobile client parses that field; do not throw a bare `IllegalArgumentException` with a vague message when a caller needs to tell the user *why* something failed (e.g. "already invited" vs "something went wrong").

### Mobile layout: `mobile/`
- `App.js`: navigation and providers only. `index.js`: entry and widget task registration.
- `screens/`: thin screens. `components/`: shared UI and modals. `hooks/use*.js`: state and business logic. `utils/`: pure helpers (`cadence.js`, `consistency.js`, `date.js`, `widgetSync.js`). `constants/`: shared copy and config. `navigation/`: stacks.
- `api/client.js` is the only place that talks to the backend. No `fetch` calls in screens or components. It parses the backend's `{"error": "..."}` body into a clean `Error.message` — always prefer `err.message` over a hardcoded string when showing feedback.
- `theme.js` holds the tokens. `widgets/` is the Android widget. `targets/widget/` is the iOS widget (Swift).
- `design/` at the repo root holds the UI mockups. Open only the one PNG that matches the task.

### Mobile visual system (do not regress)
- Fonts: use `fonts.*` or `typography.*` from `theme.js`. Never pair `fontWeight` with a Nunito `fontFamily`, because Android can silently drop the custom font.
- Gradients: progress bars and rings use `gradients.*` from `theme.js` through `expo-linear-gradient` or an SVG `<LinearGradient>`. Hero cards use `shadowLg`. The only flame icon is `components/FlameIcon.js`.
- Dark mode: every component that needs colors or typography calls `useAppTheme()` and builds styles with `useMemo(() => makeStyles(colors, typography), [colors, typography])`. `StyleSheet.create()` at module scope freezes the palette at import time. `spacing`, `radii`, `shadow`, `shadowLg`, `fonts` and `gradients` do not depend on the palette and may be imported directly.
- Widgets cannot use the in-app theme. They use the light palette only. That is a platform limit, not a regression.
- Feedback and confirmations: use `hooks/useToast.js` + `components/Toast.js` (ephemeral messages) or `hooks/useConfirm.js` + `components/ConfirmModal.js` (yes/no choices) — never `Alert.alert()`. It renders the OS's own native dialog in every build including production, not this app's visual system. Both are instantiated locally per screen/modal (not a single app-root singleton) and rendered as the last children inside that same screen/modal's own tree, because a RN `<Modal>` renders in its own native surface that an app-root overlay can't reach into.
- A `<GestureDetector>` (react-native-gesture-handler) used inside a RN `<Modal>` needs its own nested `<GestureHandlerRootView>` — the one wrapping `App.js` does not extend into a Modal's separate native surface. See `NotificationCenterModal.js` for the pattern.

### Keep these in sync
- If you add or move a UI element the onboarding tour points at, update `mobile/constants/onboardingTour.js` and register the target with `useTourTarget`.
- If the habit shape changes, update `utils/widgetSync.js` and both widget implementations.
- If a feature changes the data model, update the matching table note in `docs/background.md`.
- When a checklist item in `SKILLS.md` is done, tick it there and write what was actually verified.

## 5. Verification and quality bar

Run these before saying a task is done. Fix what you broke. Do not leave new errors or new warnings.

Backend change:
1. `cd api && ./mvnw test` passes. All 24 `@SpringBootTest` classes use the real local Postgres and Kafka from `docker compose up -d`. There is no separate test database, so tests write to the dev database.
2. New service logic gets a test. Follow the existing pattern: pure logic tested directly, services tested with outside systems mocked (`AnthropicClient`, `UserLookupService`). Tests must never call the real Anthropic API or send real email or push.
3. Check ownership: every endpoint that takes an id must verify the caller owns it or is allowed to see it.
4. A new failure case gets a specific `GlobalExceptionHandler`-mapped message, not a generic one — see §4's error-handling rule.

Mobile change:
1. `cd mobile && npx expo export --platform web` bundles clean.
2. `npx tsc --noEmit` is clean if any `.ts` or `.tsx` file changed.
3. Read the diff for the product rules and the visual system rules in sections 1 and 4: no red X, no shaming or causal copy, `useAppTheme()` pattern, `api/client.js` only, `fonts.*` only, no `Alert.alert()`.
4. Check both light and dark mode in your head or on a device, and a 360dp width.
5. If a screen gains a new async action that can fail, confirm it shows `err.message` via `showToast`, not a hardcoded string.

Always:
- Say plainly what you did not verify. Examples: not run on a device, not compiled in Xcode or Android Studio, widget code unbuilt. Do not imply it was tested.
- Run `git status` and `git diff --stat` last. Look for stray files, secrets, and unrelated edits.
- Tick the matching checklist item in `SKILLS.md`.

## 6. Safety and protected paths

Never edit, print, copy into a reply, or commit:
- `api/src/main/resources/application-secrets.properties` (gitignored, holds the Anthropic key)
- Firebase service account files: `*service-account*.json`, `*firebase-adminsdk*.json`, `*adminsdk*.json`
- `mobile/.env`, `mobile/.env.local`, `GoogleService-Info.plist`
- Any API key, password, SMTP credential or token. `spring.mail.password`, `MAIL_SMTP_PASSWORD` and `ANTHROPIC_API_KEY` stay in env vars or the secrets file.

Ask before changing:
- `firebase-storage.rules` (access rules for profile photos and feedback attachments)
- `mobile/app.json` (bundle ids, plugins, scheme), `mobile/eas.json`, and the App Group `group.com.habituate.mobile.widget`
- `mobile/google-services.json`. It is tracked on purpose and holds public client identifiers only. Do not delete or regenerate it.
- `api/src/main/resources/application.properties`, especially `ddl-auto`, Kafka settings and anything that points at a real service
- `docker-compose.yml` ports and images
- `FirebaseAuthFilter` and `SecurityConfig`. A mistake here exposes every user's data.
- The history in `SKILLS.md`. Older phases are kept as a record of what was built and why. Do not tidy them.

Ask before doing:
- Dropping a table or column, or deleting rows from the dev database
- Adding any dependency or native module
- Deploying, pushing to Railway, running `eas build` or `eas submit`, or anything that touches production or a store
- Calls that cost money or reach real people: the real Anthropic API, real push notifications, real email
- `git push`, force operations, or rewriting history

Also:
- Do not commit generated `ios/` or `android/` folders. EAS creates them at build time.
- `PRIVACY_POLICY_URL` in `mobile/screens/PrivacyScreen.js` points at `https://habituate.app/privacy`. `SKILLS.md` still calls it a placeholder. Nobody has confirmed that page is live, so treat it as a launch blocker to check before store submission. Do not change the URL without asking.

## 7. Working agreement

### Confirm the plan before changing code
Before any edit to a file, post a short plan and wait for the user to say go. This applies to small changes too. For a tiny change the plan can be two lines.

A plan covers: the goal in one sentence, the files you expect to touch, the approach, risks or product rules involved, what you will verify, and any question you need answered. Use plan mode if it is available. Read-only work (answering questions, reading code, searching) needs no confirmation. If the work changes direction midway, stop and confirm the new plan.

### Use agents for long or complicated work
Spin up agents when a task is long-running or complicated. That means any of: it spans `api/` and `mobile/`, it needs a broad search across many files, it is a large refactor, it runs a long build or test suite, or it will take many steps.

- Use a read-only search agent for wide lookups and ask for a short conclusion, not file dumps.
- Use a planning agent to design a multi-part change before the plan is posted.
- Use a general agent for long builds and test runs, so the output stays out of the main context.
- Run independent agents in parallel. Write each prompt so it stands alone: goal, paths, constraints, and the shape of report you want back.
- One agent edits a given file. If agents edit in parallel, give them separate paths.
- Do not spawn agents for small tasks. A single known file or a quick lookup is cheaper done directly.
- After a parallel batch, independently verify the result yourself (grep for stray leftovers, re-run the section 5 checks) rather than trusting each agent's self-report at face value — a confident summary is not the same as a verified one.

### Advisory review after any major build
A major build is a new feature or endpoint, an entity or schema change, a new screen or modal, a change that crosses `api/` and `mobile/`, a dependency or native-module change, or the completion of a `SKILLS.md` checklist item. It is not a copy tweak, a small bug fix, or a docs change.

After a major build and after the section 5 checks pass, run this loop. The limit is 6 rounds.

1. Launch advisory agents in parallel. They are read-only and never edit. Give each one lens and only the diff or file list, not the whole repo. Use only the lenses that apply:
   - Backend: correctness, auth and ownership, Kafka and Postgres consistency, timezone handling, test coverage.
   - Mobile: theme and font rules, thin screens, `api/client.js` use, dark mode, touch targets, tour and widget impact.
   - Product: anti-guilt copy, non-causal coach copy, scope against `SKILLS.md`, privacy.
2. Each advisor reports findings as blocker, should-fix or nit, with file and line.
3. Fix every blocker and should-fix. Skip nits unless they are one-line changes. Re-run the section 5 checks.
4. Start the next round with only the lenses that still had findings.
5. Stop when a round has no blockers or should-fix items, or after round 6, whichever comes first. Never go past 6.
6. Report to the user: rounds used, what changed, and anything still unresolved. If round 6 ends with open items, list them plainly and stop. Do not keep looping.

### Skills and token use
- Check what skills are available before hand-rolling a procedure, and load the matching one. The Expo plugin (`expo@claude-plugins-official`) is enabled in `mobile/.claude/settings.json`. Use it for Expo, EAS and config-plugin work. Use the built-in file skills for docx, xlsx, pdf and pptx output.
- `design/*.png`, `theme.js` and the visual system rules above win over any generic design skill.
- Do not read `SKILLS.md` or `docs/background.md` whole. `SKILLS.md` is about 300 lines and roughly 30k tokens. Grep for the phase heading or table name, then read just that range with an offset and limit.
- Search before reading: Grep and Glob first, then read the lines you need. Do not re-read a file you just edited.
- Skip `package-lock.json`, `node_modules/` and build output. Open design PNGs only when the task is UI work, and only the relevant one.
- Keep command output small: `./mvnw -q test`, pipe long output through `tail`, run `git diff --stat` before a full diff.
- Keep replies short: what changed, which files, what was verified and what was not.
- If the same multi-step procedure comes up repeatedly (for example "add a new feature package end to end"), suggest turning it into a project skill instead of re-explaining it each time.
