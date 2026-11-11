# CLAUDE.md

Standing instructions for any AI assistant working in this repo. Read this first. Keep it short and current. It holds rules and facts, not progress logs. Progress and the active build plan live in `SKYLINE.md`. Long-form rationale and the full data model live in `docs/background.md`. `SKILLS.md` is now a historical record of phases 0 to 10. Do not tidy it and do not use it as the plan.

## 1. Project overview

Habituate is a habit tracker for iOS and Android. Every habit is a tower in the user's skyline. Checking in builds a floor: the user holds the top of a tower for about a second, a floor lands, and the tower grows. Streaks, group streaks and the friend activity feed update from there. Users can ask "Ask Habituate", an AI coach that answers from their own check-in stats and can propose changes they must confirm.

The app is being rebuilt from the old list-and-ring UI to the new skyline UI. The backend, data model, hooks and product rules stay. Only the visual layer and some UI wording change. The target UI is specified in `SKYLINE.md` and drawn in `design/skyline/`.

Three things set it apart from generic trackers:
1. A skyline UI where progress is physical and visible: daily habits as towers with floors and a lit current run, weekly/monthly-target habits as lots (houses-on-pads or rings — see `SKYLINE.md` section 4a), solid-block Shield Days.
2. An AI coach grounded in real check-in data, not a generic chatbot.
3. Shared Habits (towers joined by a skybridge) with an explicit streak rule, plus Challenges (a landmark built together).

Core goals, in priority order:
1. Ship the active phase in `SKYLINE.md`. Do not add features outside it without updating that file first. This is a solo build and scope creep is the main risk.
2. Reach a real Play Store and App Store release. Pick store-compatible, scale-sane options over quick shortcuts.
3. Keep the product rules below true everywhere.

### Product rules (non-negotiable)
- No red X for missed days anywhere. No shaming copy. Use trend framing, not perfection framing.
- A missed day is a soft outline on the tower, labeled "open". Never draw a hole, crack, dark gap, broken tower or "missed" label. Floors are never removed or taken down.
- A streak freeze (Shield Day) has its own visual state: a plain solid block with no windows (revised 2026-11-10 — was a glass floor with a diagonal hatch). Every real check-in draws windows (lit inside the current run, dark once past it); a Shield Day floor never has any, which is the signal — not the color alone.
- Coach and any insight copy stays non-causal and tied to real data: "you complete Y on X% of the days you complete X", never "X causes Y". `CoachPrompts` enforces this in the system prompt.
- The coach never changes data on its own. A proposal only takes effect when the user confirms (`CoachService.confirmProposal`).
- Shared Habits and Challenges are separate in the data model and the UI. Do not merge them.
- Group streak recomputation happens synchronously, in the same request as the check-in write. Do not build a separate async pipeline for it.
- Another user's data is readable only through friendship-gated endpoints. Profiles default to PRIVATE.
- Check-in is a hold of about one second on the tower. A "Tap to build" setting under Accessibility turns it into a tap. Both call the same check-in API. Screen readers get an accessibility action that checks in directly.
- A tower is "topped out" only when the user chooses, and only for daily-cadence habits — weekly/monthly-target habits never top out. Default eligibility is 30 days old, but it's a per-habit setting the user can change at creation or edit (revised 2026-11-10 — was a fixed ~60 days for every habit). Topping out never resets the run. See `SKYLINE.md` section 6.
- Location is approximate only, asked once, after the user's first floor, with a plain-language explainer first. Without it the sky follows the clock and skips weather. No precise location, ever.
- Design first, mobile first. `design/skyline/*.png` is the UI spec. Target 360 to 430dp widths and 44dp touch targets. Expo web is a dev preview only, never the acceptance target.

### UI wording (copy only, never code)
User-facing text uses the skyline vocabulary. Code, API paths, database tables and variable names keep their current names (`habit`, `check-in`, `streak`, `shield`). Do not rename any of them.

| Code name | UI wording |
|---|---|
| habit (daily cadence) | tower |
| habit (weekly/monthly target) | period lot (revised 2026-11-10 — see `SKYLINE.md` section 4a) |
| create habit | Lay a foundation |
| check-in | build a floor |
| streak | run ("9 day run") |
| best streak | best run (a white ledge on the tower) |
| Shield Day | Shield Day, shown as a glass floor |
| missed day | open floor |
| archive | Retire (becomes a grey monument) |
| complete a habit | Top out |
| Shared Habit | Build together |
| Challenge | Raise a landmark |
| Today tab | Skyline tab |

## 2. Tech stack

### Mobile (`mobile/`)
- Expo SDK 57 (`expo ~57.0.21`), React Native 0.86.3, React 19.2.3, New Architecture. Package manager: npm.
- JavaScript with functional components and hooks. TypeScript only where it already exists (`mobile/widgets/HabitWidget.tsx`).
- React Navigation 7 (bottom tabs plus native stack), `firebase` JS SDK ^10.14.1, `react-native-reanimated` 4, `react-native-gesture-handler`, `react-native-svg`, `expo-linear-gradient`, `expo-haptics`, Nunito via `@expo-google-fonts/nunito`.
- Native pieces: `expo-dev-client`, `@bacons/apple-targets` (iOS widget), `react-native-android-widget`, `react-native-shared-group-preferences`, Google Sign-In, Facebook SDK, Apple authentication.
- The skyline is drawn with `react-native-svg` first. `@shopify/react-native-skia` may be added only if the Phase 0 spike in `SKYLINE.md` shows `react-native-svg` misses the frame-time target. The owner has agreed to that, and it needs an EAS build. Write the spike result into `SKYLINE.md` before adding it.
- `expo-location` (approximate location for the sky) is a new native module. Ask before adding it, when Phase 2 reaches it.
- Before writing Expo code, read the v57 docs: https://docs.expo.dev/versions/v57.0.0/ (also in `mobile/AGENTS.md`).

### Backend (`api/`)
- Java 21, Spring Boot 3.3.3, Maven wrapper (`./mvnw`).
- Spring Web, Data JPA (Hibernate), Validation, Security, Actuator, Mail, `firebase-admin` 9.4.1.
- Coach: Anthropic Messages API called with `RestClient` (no SDK) in `AnthropicClient`, model `claude-sonnet-5`, server side only.
- Schema comes from `spring.jpa.hibernate.ddl-auto=update`. There are no migrations yet. Flyway is part of the launch readiness phase in `SKYLINE.md`.

### Data and services
- Postgres 16 (docker `postgres:16-alpine`).
- Firebase Auth (email/password, Google, Facebook, Apple). The backend verifies the ID token on every request in `FirebaseAuthFilter`.
- Push goes through Expo's push service, not FCM directly. Photos and feedback attachments upload from the client straight to Firebase Storage.
- Weather for the sky comes from the backend or a keyless provider. The decision is open in `SKYLINE.md` section 14. Never put a weather or any other API key in the client.
- Hosting: the API appears to run on Railway today (`PORT` placeholder in `application.properties`, `EXPO_PUBLIC_API_URL` in `mobile/eas.json`). Terraform on AWS (ECS Fargate, RDS) is planned. `infra/` is an empty placeholder.

### Do not
- Do not add Redux or another state library. Use hooks and the existing providers.
- Do not use GraphQL (REST only for v1) or class components. Do not treat the Expo web preview as a deliverable.
- Do not call Anthropic from the mobile app or put an API key in the client.
- Do not expose JPA entities from controllers. Do not accept a client-supplied user ID. Read `userId` from the request attribute set by `FirebaseAuthFilter`.
- Do not add a message broker or event-streaming pipeline for in-app updates. Group streaks, notifications and the activity feed all read straight from Postgres via direct, synchronous service calls in the same request.
- Do not add a native module, run `expo prebuild` and commit `ios/` or `android/`, or add any dependency without asking. The home-screen widgets are the one approved exception to staying managed-workflow friendly. Skia is conditionally pre-approved as described above.
- Do not set `fontWeight` together with a Nunito `fontFamily`. Do not import `colors`, `typography` or `streakStates` from `theme.js` inside components. Do not use a plain `fire` icon or flat progress-bar colors. See section 4.
- Do not rename habit, check-in or streak in code. The skyline vocabulary is copy only.

## 3. Commands

The author works on Windows. Use `./mvnw` in bash and `mvnw.cmd` in PowerShell.

```bash
# Local infra: postgres :5432, pgadmin :5050
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
cd mobile && npx expo-doctor              # run at the start of Phase 0 and after any dependency change
eas build --profile development --platform android|ios   # custom dev client (run from mobile/)
```

Notes:
- There is no mobile test script and no lint script in either project. Do not invent one. Do not claim lint passed. If a phase needs scene-engine tests, ask before adding a test runner.
- Test on an EAS development client. Expo Go cannot load the widget targets or the native Google and Facebook sign-in modules.
- To point the app at another API host, set `EXPO_PUBLIC_API_URL` before `expo start` (or in `mobile/.env.local`, which already points development builds at the Railway production API, see section 2).
- `eas build` costs build minutes and `./mvnw test` writes to the dev database (see section 5). Both are fine when the task needs them. Say so before running them.

## 4. Architecture and directory map

### Write path
Mobile app, then Spring Boot API, then Postgres (source of truth), in the same request. The check-in write in `HabitService` is `@Transactional`, and any group streak recompute happens synchronously right after, in the service layer, never the controller.

### Backend layout: `api/src/main/java/com/habituate/api/`
Package by feature. Each feature owns its controller, service, repository, entities and DTOs.

| Package | Owns |
|---|---|
| `habits` | habit CRUD, check-ins, `StreakCalculator`, shield awards, personal freeze scheduler, towers (top-out segments, see `SKYLINE.md` section 6) |
| `checkins` | check-in entity, repository, request and response DTOs |
| `goals` | freeform goals, period progress and rollover |
| `groups` | friendships, shared habits, group streaks, challenges, activity feed, cheers |
| `coach` | Ask Habituate: context builder, prompts, Anthropic client, proposals, reactions |
| `notifications` | in-app notifications, Expo push, reminder and period-summary schedulers |
| `users` | profile, username, timezone, visibility, friend profile, account deletion |
| `feedback` | bug and suggestion reports, email notification |
| `config` | Firebase, security, CORS, `FirebaseAuthFilter` |
| `common` | shared exceptions and `GlobalExceptionHandler` |
| `health` | `GET /api/health` |

Placement rules:
- Controllers stay thin. Business logic and ownership checks go in services.
- Keep pure logic separate from Spring so it is easy to test (`StreakCalculator`, `GroupStreakEngine`).
- DTOs named `*Request` and `*Response` sit at the API boundary.
- Scheduled jobs live in the feature package they serve.
- Day bucketing uses the `X-Timezone` request header. Scheduled jobs use the stored `users.timezone`, or UTC when there is none.
- Cross-user reads must go through `FriendshipService.areFriends` or an equivalent membership check. Re-derive ownership from the stored row, never from the caller's input.
- Entity changes alter the dev schema automatically. A removed column or table is not dropped for you. Ask before dropping anything.
- Errors go through `GlobalExceptionHandler` as `{"error": "..."}` with a specific, user-facing message, never a generic one. The mobile client parses that field. Do not throw a bare `IllegalArgumentException` with a vague message when a caller needs to tell the user why something failed (for example "already invited" versus "something went wrong").

### Mobile layout: `mobile/`
- `App.js`: navigation and providers only. `index.js`: entry and widget task registration.
- Four tabs: Skyline, Insights, Community, Profile. The old Habits tab is removed. Creating, editing, retiring and topping out a tower all happen from the Skyline tab (empty lot, tower sheet, forms).
- `screens/`: thin screens. `components/`: shared UI and modals. `hooks/use*.js`: state and business logic. `utils/`: pure helpers. `constants/`: shared copy and config. `navigation/`: stacks.
- Skyline additions (created in Phase 1 and 2 of `SKYLINE.md`):
  - `utils/skylineScene.js`: pure scene builder. `buildScene(habits, options)` returns a flat list of polygons. No React, no I/O.
  - `utils/sky.js`: pure mapping from local time and weather to a sky kind.
  - `components/SkylineView.js`, `components/SkylineTower.js`: paint a scene with `react-native-svg`.
  - `components/SkyBackdrop.js`: paints the sky.
- `api/client.js` is the only place that talks to the backend. No `fetch` calls in screens or components. It parses the backend's `{"error": "..."}` body into a clean `Error.message`. Always prefer `err.message` over a hardcoded string when showing feedback.
- `theme.js` holds the tokens. `widgets/` is the Android widget. `targets/widget/` is the iOS widget (Swift). Widgets keep their current layout.
- `design/skyline/` at the repo root holds the UI mockups for the rebuild. The old `design/*.png` files show the old UI and are history once Phase 8 replaces them. Open only the one PNG that matches the task.

### Mobile visual system (do not regress)
- Fonts: use `fonts.*` or `typography.*` from `theme.js`. Never pair `fontWeight` with a Nunito `fontFamily`, because Android can silently drop the custom font.
- Gradients: progress bars and rings use `gradients.*` from `theme.js` through `expo-linear-gradient` or an SVG `<LinearGradient>`. Hero cards use `shadowLg`. The only flame icon is `components/FlameIcon.js`.
- Dark mode: every component that needs colors or typography calls `useAppTheme()` and builds styles with `useMemo(() => makeStyles(colors, typography), [colors, typography])`. `StyleSheet.create()` at module scope freezes the palette at import time. `spacing`, `radii`, `shadow`, `shadowLg`, `fonts` and `gradients` do not depend on the palette and may be imported directly.
- The mockups in `design/skyline/` are dark mode only. Light mode needs its own tower and sky palette, checked for contrast. Build it in Phase 1, not at the end.
- Tower colors come from `categoryColor` in `constants/habitCategories.js`. Each category needs a checked light and dark variant.
- Widgets cannot use the in-app theme. They use the light palette only. That is a platform limit, not a regression.
- Feedback and confirmations: use `hooks/useToast.js` + `components/Toast.js` (ephemeral messages) or `hooks/useConfirm.js` + `components/ConfirmModal.js` (yes/no choices). Never `Alert.alert()`. It renders the OS's own native dialog in every build including production, not this app's visual system. Both are instantiated locally per screen or modal (not a single app-root singleton) and rendered as the last children inside that same screen or modal's own tree, because a RN `<Modal>` renders in its own native surface that an app-root overlay can't reach into.
- A `<GestureDetector>` (react-native-gesture-handler) used inside a RN `<Modal>` needs its own nested `<GestureHandlerRootView>`. The one wrapping `App.js` does not extend into a Modal's separate native surface. See `NotificationCenterModal.js` for the pattern. The hold-to-build gesture on the skyline uses the same pattern when it is inside a sheet.
- Skyline performance budget: at most about 600 polygons on screen, each tower's faces merged into a few `Path` elements per color and memoized, only the changed floor animates, and a tower never draws more than about 60 floors (older floors collapse into tiers). Respect Reduce Motion.
- Every tower has an accessibility label such as "Read 10 minutes, 12 of the last 14 days set, 9 day run". The bottom sheet list on the Skyline screen is the full non-visual equivalent.

### Keep these in sync
- If you add or move a UI element the onboarding tour points at, update `mobile/constants/onboardingTour.js` and register the target with `useTourTarget`.
- If the habit shape changes, update `utils/widgetSync.js` and both widget implementations.
- If a feature changes the data model, update the matching table note in `docs/background.md`.
- When a checklist item in `SKYLINE.md` is done, tick it there and write what was actually verified.
- Every tower, tile, sheet button and form control gets a stable `testID` and accessibility label. The Maestro flows depend on them.

## 5. Verification and quality bar

Run these before saying a task is done. Fix what you broke. Do not leave new errors or new warnings.

Backend change:
1. `cd api && ./mvnw test` passes. All `@SpringBootTest` classes use the real local Postgres from `docker compose up -d`. There is no separate test database, so tests write to the dev database.
2. New service logic gets a test. Follow the existing pattern: pure logic tested directly, services tested with outside systems mocked (`AnthropicClient`, `UserLookupService`). Tests must never call the real Anthropic API or send real email or push.
3. Check ownership: every endpoint that takes an id must verify the caller owns it or is allowed to see it.
4. A new failure case gets a specific `GlobalExceptionHandler`-mapped message, not a generic one. See section 4.

Mobile change:
1. `cd mobile && npx expo export --platform web` bundles clean.
2. `npx tsc --noEmit` is clean if any `.ts` or `.tsx` file changed.
3. Read the diff for the product rules and the visual system rules in sections 1 and 4: no red X, no hole or "missed" visuals, no shaming or causal copy, `useAppTheme()` pattern, `api/client.js` only, `fonts.*` only, no `Alert.alert()`.
4. Check both light and dark mode in your head or on a device, and a 360dp width.
5. If a screen gains a new async action that can fail, confirm it shows `err.message` via `showToast`, not a hardcoded string.
6. For any screen in the rebuild, compare against its PNG in `design/skyline/` and list every difference you could not match.

Always:
- Say plainly what you did not verify. Examples: not run on a device, not compiled in Xcode or Android Studio, widget code unbuilt, frame rate not measured. Do not imply it was tested.
- Run `git status` and `git diff --stat` last. Look for stray files, secrets, and unrelated edits.
- Tick the matching checklist item in `SKYLINE.md`.

## 6. Safety and protected paths

Never edit, print, copy into a reply, or commit:
- `api/src/main/resources/application-secrets.properties` (gitignored, holds the Anthropic key)
- Firebase service account files: `*service-account*.json`, `*firebase-adminsdk*.json`, `*adminsdk*.json`
- `mobile/.env`, `mobile/.env.local`, `GoogleService-Info.plist`
- Any API key, password, SMTP credential or token. `spring.mail.password`, `MAIL_SMTP_PASSWORD` and `ANTHROPIC_API_KEY` stay in env vars or the secrets file.

Ask before changing:
- `firebase-storage.rules` (access rules for profile photos and feedback attachments)
- `mobile/app.json` (bundle ids, plugins, scheme, location permission strings), `mobile/eas.json`, and the App Group `group.com.habituate.mobile.widget`
- `mobile/google-services.json`. It is tracked on purpose and holds public client identifiers only. Do not delete or regenerate it.
- `api/src/main/resources/application.properties`, especially `ddl-auto` and anything that points at a real service
- `docker-compose.yml` ports and images
- `FirebaseAuthFilter` and `SecurityConfig`. A mistake here exposes every user's data.
- The history in `SKILLS.md`. Older phases are kept as a record of what was built and why. Do not tidy them.

Ask before doing:
- Dropping a table or column, or deleting rows from the dev database
- Adding any dependency or native module (except Skia under the condition in section 2)
- Deploying, pushing to Railway, running `eas build` or `eas submit`, or anything that touches production or a store
- Calls that cost money or reach real people: the real Anthropic API, a real weather provider, real push notifications, real email
- `git push`, force operations, or rewriting history

Also:
- Do not commit generated `ios/` or `android/` folders. EAS creates them at build time.
- `PRIVACY_POLICY_URL` in `mobile/screens/PrivacyScreen.js` points at `https://habituate.app/privacy`. Nobody has confirmed that page is live, so treat it as a launch blocker to check before store submission. Do not change the URL without asking.

## 7. Working agreement

### Session defaults
- Work in the main session. Do not spawn subagents unless the user explicitly asks. This overrides the "Use agents for long or complicated work" guidance below.
- Read only the files needed. Grep before reading.
- Keep replies short: brief summaries of what was done, not a narration.
- Run targeted tests only (one class, one file), not the full suite, unless asked.
- Stop after two failed attempts at the same fix and report to the user, rather than trying a third variation.

### Confirm the plan before changing code
Before any edit to a file, post a short plan and wait for the user to say go. This applies to small changes too. For a tiny change the plan can be two lines.

A plan covers: the goal in one sentence, the files you expect to touch, the approach, risks or product rules involved, what you will verify, and any question you need answered. Use plan mode if it is available. Read-only work (answering questions, reading code, searching) needs no confirmation. If the work changes direction midway, stop and confirm the new plan.

### The Skyline rebuild
- The rebuild replaces the UI. It is not a toggle and not a second app. There is no Classic mode for users.
- Keep `hooks/use*.js`, `api/client.js`, `utils/` and all backend services unless `SKYLINE.md` says a phase changes them. New screens call the same hooks.
- Build new screens in new files. Register each tab's new screen in `App.js` when it reaches parity with the old one. A development-only switch may flip tabs while testing. It must not ship.
- Before deleting an old screen, write its parity checklist (every action the old screen offers, taken from the code and its Maestro flows) into `SKYLINE.md` and tick each item against the new screen. Delete old screens and components in one cleanup commit in the last phase, not piecemeal.
- Work one phase at a time, in the order in `SKYLINE.md`. Do not start a phase until the previous phase's gate is met and the user has said go.
- Decisions marked open in `SKYLINE.md` section 14 must be asked, not guessed, before the phase that depends on them.

### Consult the Opus advisor at three points
Spawn a read-only Opus advisor subagent (give it the plan, diff, or error, not the whole repo) at:
1. Before a plan locks: after drafting it, before posting it for the user's go-ahead.
2. After hitting the same error twice: the second time a fix attempt fails the same way, stop and get a second opinion before trying a third variation blind.
3. Before marking a task done: after the section 5 verification checks pass, before telling the user it's finished.

This is a standing convention, not a tool-enforced gate. There is no automatic trigger for it, so apply it deliberately at these three moments. The advisor is read-only: it never edits, and its input doesn't override the user's. If it disagrees with the plan, surface that to the user rather than silently changing course. This is the one case where spawning a subagent is allowed without the user asking.

### Use agents for long or complicated work
Spin up agents when a task is long-running or complicated. That means any of: it spans `api/` and `mobile/`, it needs a broad search across many files, it is a large refactor, it runs a long build or test suite, or it will take many steps.

- Use a read-only search agent for wide lookups and ask for a short conclusion, not file dumps.
- Use a planning agent to design a multi-part change before the plan is posted.
- Use a general agent for long builds and test runs, so the output stays out of the main context.
- Run independent agents in parallel. Write each prompt so it stands alone: goal, paths, constraints, and the shape of report you want back.
- One agent edits a given file. If agents edit in parallel, give them separate paths.
- Do not spawn agents for small tasks. A single known file or a quick lookup is cheaper done directly.
- After a parallel batch, independently verify the result yourself (grep for stray leftovers, re-run the section 5 checks) rather than trusting each agent's self-report at face value. A confident summary is not the same as a verified one.

### Advisory review after any major build
A major build is a new feature or endpoint, an entity or schema change, a new screen or modal, a change that crosses `api/` and `mobile/`, a dependency or native-module change, or the completion of a `SKYLINE.md` checklist item. It is not a copy tweak, a small bug fix, or a docs change.

After a major build and after the section 5 checks pass, run this loop. The limit is 6 rounds.

1. Launch advisory agents in parallel. They are read-only and never edit. Give each one lens and only the diff or file list, not the whole repo. Use only the lenses that apply:
   - Backend: correctness, auth and ownership, Postgres consistency, timezone handling, test coverage.
   - Mobile: theme and font rules, thin screens, `api/client.js` use, dark and light mode, touch targets, performance budget, accessibility labels, tour and widget impact.
   - Product: anti-guilt visuals and copy, non-causal coach copy, scope against `SKYLINE.md`, privacy and location handling.
2. Each advisor reports findings as blocker, should-fix or nit, with file and line.
3. Fix every blocker and should-fix. Skip nits unless they are one-line changes. Re-run the section 5 checks.
4. Start the next round with only the lenses that still had findings.
5. Stop when a round has no blockers or should-fix items, or after round 6, whichever comes first. Never go past 6.
6. Report to the user: rounds used, what changed, and anything still unresolved. If round 6 ends with open items, list them plainly and stop. Do not keep looping.

### Skills and token use
- Check what skills are available before hand-rolling a procedure, and load the matching one. The Expo plugin (`expo@claude-plugins-official`) is enabled in `mobile/.claude/settings.json`. Use it for Expo, EAS and config-plugin work. Use the built-in file skills for docx, xlsx, pdf and pptx output.
- `design/skyline/*.png`, `theme.js` and the visual system rules above win over any generic design skill.
- Do not read `SKILLS.md` or `docs/background.md` whole. Grep for the heading or table name, then read just that range with an offset and limit. `SKYLINE.md` is the file to read first for any rebuild task; read the section for the current phase, not the whole file.
- Search before reading: Grep and Glob first, then read the lines you need. Do not re-read a file you just edited.
- Skip `package-lock.json`, `node_modules/` and build output. Open design PNGs only when the task is UI work, and only the relevant one.
- Keep command output small: `./mvnw -q test`, pipe long output through `tail`, run `git diff --stat` before a full diff.
- Keep replies short: what changed, which files, what was verified and what was not.
- If the same multi-step procedure comes up repeatedly (for example "add a new feature package end to end"), suggest turning it into a project skill instead of re-explaining it each time.
