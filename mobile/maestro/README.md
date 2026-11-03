# Maestro flows for Habituate

End-to-end flows for the Android app, written against a real build (dev
client or the `preview` EAS profile) — not Expo Go, which can't load the
widget targets or the native Google/Facebook sign-in modules. See
`CLAUDE.md` §2 for why.

**These have never been executed.** They were authored by reading the app's
actual screens, accessibility labels, and visible button/placeholder text —
not by running Maestro against a live device (this environment has no `adb`
or attached emulator; see the project's own notes on why Maestro was picked
but never run). Treat the first full run of each flow as the real test of
whether the selector actually matches what's on screen, not just of the app.

## Running them

```bash
# Maestro CLI, installed separately — not an npm dependency of this repo
curl -Ls "https://get.maestro.mobile.dev" | bash

# Point maestro at a connected device/emulator with the app installed
maestro test mobile/maestro/00_auth/login.yaml --env TEST_EMAIL=you@example.com --env TEST_PASSWORD=yourpassword

# Run everything in a folder
maestro test mobile/maestro/02_today

# Run the whole suite
maestro test mobile/maestro
```

Every flow that needs to be signed in starts with `runFlow: ../_shared/login.yaml`, which reads `${TEST_EMAIL}` / `${TEST_PASSWORD}` — pass these via `--env` or a `.env` file Maestro loads automatically from the working directory. **Use a real but disposable test account** — several flows write data (check-ins, friend requests, shared habits, challenges) that this suite does not clean up after itself.

`05_community/add_friend.yaml` needs a *second* account too (`${TEST_EMAIL_2}` / `${TEST_PASSWORD_2}`) — run `00_auth/signup.yaml` once for each email first (with the matching env vars) to provision both, then the Community flows that assume existing friends/shared-habit activity can build on them.

## Two things found while writing these (not fixed here)

- `components/AddFriendModal.js`'s accept/decline icons on an incoming
  friend request (~line 277-282) have no `accessibilityLabel` — every other
  action in that screen does. Worth adding
  `` `Accept ${name}'s request` ``/`` `Decline ${name}'s request` `` for
  consistency (and so a flow can actually tap Accept — this suite currently
  can't).
- `components/AskHabituateModal.js`'s back link always reads "Insights"
  (line ~207) even when opened from Today's own "Ask Habituate" teaser —
  minor, but worth a glance since it names the wrong tab for half its entry
  points.

## Layout

- `_shared/` — reusable sub-flows (`runFlow`'d from other files), not meant to be run standalone.
- `00_auth/` — sign up, sign in, sign out.
- `01_onboarding/` — the first-run tour: full walkthrough, the fast-path skip, replay from settings.
- `02_today/` — the Today tab: check-in, undo, Shield Days, streak repair, the empty-state template picker.
- `03_habits/` — habit CRUD: create (full form), edit, archive/restore, delete, goals.
- `04_insights/` — period switching, the Consistency detail drill-down (including the bar-tap-opens-calendar feature), Ask Habituate.
- `05_community/` — friends, shared habits, challenges, the activity feed (cheer/dismiss), notifications.
- `06_profile/` — profile editing, visibility, stats, account settings navigation.

## Deliberately not automated here

- **Google / Facebook / Apple sign-in** — these hand off to a native OS
  chooser or an in-app browser Maestro can't reliably drive across devices.
  Only email/password is covered in `00_auth/`.
- **Account deletion** — destructive and irreversible. Not included in the
  default suite at all; if you need to test it, write a one-off flow by hand
  against a throwaway account and run it deliberately, never as part of a
  batch.
- **The home-screen widget** — Maestro drives in-app UI, not the Android
  launcher/widget surface. Widget behavior needs manual verification (see
  `mobile/widgets/`).
- **Push notifications actually arriving** — `ReminderScheduler`/
  `ChallengeReminderScheduler` fire server-side on a cron; nothing here
  waits 30+ minutes for a real one. `05_community/notification_center.yaml`
  only checks the Notification Center UI itself, not that a specific
  reminder landed in it.

## What to do when a flow fails

Per this project's own working agreement: a failed flow is evidence, not a
verdict to paper over. Record what actually happened (the Maestro output,
a screenshot if the CLI captured one) against the specific screen/behavior
it was checking, fix the one thing it points at, and re-run just that flow
before moving on — not the whole suite.
