/**
 * Pure decision logic for the App Store review prompt (SKYLINE.md Phase 8a):
 * fire once, ever, on the first streak-milestone celebration a user sees
 * (buildStreakMilestone in utils/celebration.js — a real multiple-of-7-day
 * run, the same "good moment" ProtectionInfoModal already celebrates a
 * Shield around). Kept separate from hooks/useReviewPrompt.js's native
 * calls (expo-store-review, AsyncStorage) so this is testable without them.
 */
export function isReviewMilestone(payload) {
  // `key` disambiguates buildStreakMilestone's payload from
  // buildHabitMilestone's (both share variant: 'milestone' and carry a
  // `streak` field) — only the streak-specific one should prompt.
  return Boolean(payload) && typeof payload.key === 'string' && payload.key.startsWith('milestone-streak-');
}
