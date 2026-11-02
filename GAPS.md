# GAPS.md — Retention research vs. what's built, 2026-11-02

Researched 5 apps in the habit/behavior-change space with documented retention results: **Streaks** (iOS gold-standard, chain mechanic), **Habitica** (gamified/party accountability, cited 41% higher 30-day retention for party users), **Duolingo** (streak mechanics drove 4.5x DAU growth over four years, documented notification/comeback architecture), **Finch** (self-care pet app, ~60% Day-1 retention), **Atoms** (James Clear's app, cited as smoothest onboarding tested — first habit created and checked off within 60 seconds).

Every item below is cross-checked against `STATE.md`: either it's genuinely not built, or it's built in a materially weaker form than the cited app's approach. Two categories of idea are deliberately **excluded** even though they're common retention tactics in this space: Habitica's XP/quest/RPG gamification layer and Finch's pet-whose-wellbeing-depends-on-you mechanic. Both work by making the user feel bad (a disappointed pet, a stalled quest) when they don't show up — that's exactly what `CLAUDE.md`'s anti-guilt rule rules out. Not a gap; a deliberate non-fit.

---

## Streaks

- **Streak repair, not just streak prevention.** Duolingo's comeback mechanics (streak freeze *and* streak repair *and* event-based revival of a lost 30+ day streak) treat a broken streak as recoverable, not final. Habituate has streak freeze for groups only (auto-applied, prevents breaking) and explicitly deferred personal streak freezes — but nothing lets a user who already broke a streak get any of it back. A non-punitive "repair" option (e.g., one free repair per month, framed as "pick back up" not "redeem yourself") fits the anti-guilt philosophy better than Duolingo's own fear-based original design, while closing a real gap: right now a broken personal streak in Habituate is just gone. *(Source: Duolingo)*
- **Personal streak freeze — the deferred half of an already-designed feature.** `streak_freezes` already has a nullable `user_id` column specifically so this is additive, per `SKILLS.md`'s own note. Duolingo's data: freezes don't move day-21 survival much early, but produce a 4.5x longer average streak by day 21. This is the single most directly-evidenced, cheapest-to-build item in this whole list — the schema and the group-side implementation already exist as a template. *(Source: Duolingo)*

## Onboarding

- **Time-to-first-logged-action as an explicit design target.** Atoms' onboarding gets a user's first habit created *and* checked off within 60 seconds of install — tested and cited as the smoothest onboarding in the category. Habituate's 15-step tour (per `SKILLS.md` Phase 7) walks through real screens and real modals across all five tabs before the user necessarily logs anything — thorough, but optimized for feature coverage, not speed-to-first-win. Worth measuring directly (Phase 5's interaction review) and, if slow, offering a "skip the tour, just add your first habit" fast path that gets to a first check-in before anything else. *(Source: Atoms)*
- **Identity-framed habit creation, optionally.** Atoms frames every habit as "I will [habit], [time/location], so I can become [identity]" rather than a bare name/cadence form. Habituate's add-habit form (name, category, cadence, tracking mode) is purely mechanical. An optional "why" field wouldn't just mirror Atoms — it would directly feed `CoachContextBuilder`, giving Ask Habituate a stated motivation to ground future answers in, which Atoms' version can't do since it has no AI coach. Keep it optional; this app's whole design philosophy is "don't force commitment theater." *(Source: Atoms)*

## Notifications

- **A soft pre-permission screen before the OS push prompt.** Duolingo's documented strategy explicitly "paints a positive picture around notifications so users are more likely to allow them" before the system dialog fires — because a denied OS prompt is much harder to reverse than a skipped in-app explainer. `SKILLS.md`'s Phase 7 notes describe `usePushToken` requesting permission but not a preceding explainer screen. One screen, shown once, costs little and directly protects a feature (push reminders) that's already fully built on the backend. *(Source: Duolingo)*
- **Goal-referencing reminder copy, not streak-protection copy.** Duolingo's own A/B finding: a reminder referencing the user's actual stated goal ("you're three lessons from B1 Spanish") outperforms a streak-fear reminder ("don't break your streak"). Habituate's anti-guilt rule already rules out fear-framing by policy, but it's worth explicitly auditing `ReminderScheduler`'s actual notification copy against this finding to make sure reminders reference what the habit is *for*, not just that it's due. *(Source: Duolingo)*

## Empty states

- **Audit every first-use empty state for a single, specific CTA.** Current UX research consensus (not app-specific, but directly actionable): a good empty state explains *why* it's empty and gives one clear next action — never generic "no data" copy. `SKILLS.md` confirms Today's empty state is "non-punitive," but doesn't document what Habits/Insights/Community look like on a genuinely fresh account (zero habits, zero friends, zero groups). Worth a pass in Phase 5's UI review specifically checking each tab's zero-state has a real CTA, not just absence-of-shaming (a lower bar than "actively guides the next action"). *(Source: general UX research, not one app)*

## Speed

- Not independently measured in this audit (`STATE.md` ran compile/bundle/test checks, not runtime performance). Given Atoms' cited "first action within 60 seconds" is explicitly a speed claim, Phase 5's performance lens should include: cold-start time to the Today screen, and time from tapping "+ New Habit" to a habit actually existing and checkable. No proposal here beyond "measure it" — don't guess at a fix for a problem not yet confirmed to exist.

---

## Not proposed, and why

- **Habitica-style XP/levels/quests.** 41% retention lift for party users is real, but Habitica's core loop is gamification-for-its-own-sake (losing HP for missed dailies, etc.) — incompatible with the anti-guilt rule. Habituate's Shared Habits/group streaks already deliver the social-accountability half of Habitica's party effect without the punitive game-state layer.
- **Finch-style companion pet tied to task completion.** The retention mechanic *is* the guilt lever (a pet that needs you) — the opposite of this app's stated design philosophy. Excluded on principle, not oversight.
