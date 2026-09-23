/**
 * Builds payloads for the post-check-in celebration overlay. Two shapes:
 *   - "checkin": shown on every check-in — today's progress + this habit's streak.
 *   - "milestone": shown only on the specific check-in/update that crosses a
 *     habit's or goal's period target, never re-shown once already met.
 *
 * All completion checks are prospective (current state + the delta this
 * action is about to add), computed synchronously before the write — this
 * avoids any race with the async refresh that follows a check-in.
 */

const CHECKIN_HEADLINES = ['Nice one!', 'Logged.', 'That’s the way.', 'Good rep.', 'That counts.'];

function pickHeadline() {
  return CHECKIN_HEADLINES[Math.floor(Math.random() * CHECKIN_HEADLINES.length)];
}

function progressPhrase(done, total) {
  if (!total || total <= 0) return null;
  if (done >= total) return `${done} of ${total} today — that's everything.`;
  if (done / total >= 0.5) return `${done} of ${total} today — you're over halfway there.`;
  return `${done} of ${total} today.`;
}

/** Same tiering as progressPhrase, but for a habit's own weekly/monthly
 * window (e.g. "2 of 3 this week") instead of the daily due-today count. */
function ownPeriodPhrase(done, total, noun) {
  if (!total || total <= 0) return null;
  const period = noun || 'this period';
  if (done >= total) return `${done} of ${total} ${period} — that's everything.`;
  if (done / total >= 0.5) return `${done} of ${total} ${period} — you're over halfway there.`;
  return `${done} of ${total} ${period}.`;
}

function remainingTodayPhrase(done, total) {
  if (!total || total <= 0) return null;
  const left = total - done;
  if (left <= 0) return "That's everything else for today too.";
  return `${left} more habit${left === 1 ? '' : 's'} left today.`;
}

function streakPhrase(streak) {
  if (!streak || streak <= 0) return null;
  return `${streak} day${streak === 1 ? '' : 's'} in a row`;
}

/**
 * The streak this check-in produces, not the one it started with. `habit`
 * here is always the pre-check-in snapshot (the async write hasn't happened
 * yet when this runs), so a habit not yet checked in today gets +1 — a
 * habit already checked in today (a second count-mode tap) keeps its streak
 * unchanged since today was already counted.
 */
function prospectiveStreak(habit) {
  const current = habit.streak || 0;
  return habit.checkedInToday ? current : current + 1;
}

/**
 * Routine check-in — shown every time, independent of any target. A genuine
 * daily habit (habit.dueToday) reports against today's due-habit count; a
 * weekly/monthly-only habit was never part of that count in the first place,
 * so it reports its own period progress instead — checking in a weekly habit
 * after finishing every daily one shouldn't claim credit for the dailies.
 */
export function buildCheckInCelebration(habit, delta = 1, { todayDone = 0, todayTotal = 0 } = {}) {
  const streakLine = streakPhrase(prospectiveStreak(habit));
  const progressLine = habit.dueToday
    ? progressPhrase(todayDone, todayTotal)
    : ownPeriodPhrase(
        Math.min(habit.periodTarget || 0, (habit.periodDone || 0) + delta),
        habit.periodTarget,
        habit.periodNoun
      );

  return {
    key: `checkin-${habit.id}-${Date.now()}`,
    variant: 'checkin',
    headline: pickHeadline(),
    subhead: habit.name,
    progressLine,
    streakLine,
    streak: prospectiveStreak(habit),
    shareText: [`${habit.name} — logged!`, progressLine, streakLine ? `🔥 ${streakLine}` : null]
      .filter(Boolean)
      .join('\n'),
  };
}

/**
 * Whether adding `delta` to a habit's current progress would complete every
 * target it has set (weekly and/or monthly can both be active at once).
 */
function prospectiveHabitComplete(habit, delta) {
  const weeklyTarget = habit.weeklyTarget;
  const monthlyTarget = habit.monthlyTarget;

  if (!weeklyTarget && !monthlyTarget) {
    return (habit.periodDone || 0) + delta >= (habit.periodTarget || 1);
  }
  const weeklyMet = !weeklyTarget || (habit.weeklyDone || 0) + delta >= weeklyTarget;
  const monthlyMet = !monthlyTarget || (habit.monthlyDone || 0) + delta >= monthlyTarget;
  return weeklyMet && monthlyMet;
}

/** Null unless this exact check-in is what completes the habit's target(s). */
export function buildHabitMilestone(habit, delta = 1, { todayDone, todayTotal } = {}) {
  if (habit.periodComplete) return null; // already met before this check-in
  if (!prospectiveHabitComplete(habit, delta)) return null;

  const streakLine = streakPhrase(prospectiveStreak(habit));
  const targetLine = `${habit.name}: target met for ${habit.periodNoun || 'this period'}.`;
  const remainingLine = remainingTodayPhrase(todayDone, todayTotal);
  const progressLine = [targetLine, remainingLine].filter(Boolean).join(' ');

  return {
    key: `milestone-habit-${habit.id}-${Date.now()}`,
    variant: 'milestone',
    headline: 'Target met! 🎉',
    subhead: habit.name,
    progressLine,
    streakLine,
    streak: prospectiveStreak(habit),
    shareText: [targetLine, streakLine ? `🔥 ${streakLine}` : null].filter(Boolean).join('\n'),
  };
}

/** Null unless this check-in is what finishes every habit due today. */
export function buildAllDoneCelebration(previousDone, todayDone, todayTotal) {
  if (!todayTotal || todayTotal <= 0) return null;
  if (previousDone >= todayTotal) return null; // already finished before this check-in
  if (todayDone < todayTotal) return null; // still not finished

  const progressLine = `${todayTotal} of ${todayTotal} habits complete.`;

  return {
    key: `all-done-${todayTotal}-${Date.now()}`,
    variant: 'milestone',
    headline: 'All done for today! 🎉',
    subhead: null,
    progressLine,
    streakLine: null,
    shareText: `Finished all ${todayTotal} habits today!`,
  };
}

/** Null unless this exact progress update is what completes the goal's target. */
export function buildGoalMilestone(goal, delta) {
  if (goal.complete) return null;
  const newCount = (goal.currentCount || 0) + delta;
  if (newCount < goal.targetCount) return null;

  const progressLine = `${goal.description}: ${newCount} of ${goal.targetCount} — done.`;

  return {
    key: `milestone-goal-${goal.id}-${Date.now()}`,
    variant: 'milestone',
    headline: 'Goal complete! 🎉',
    subhead: goal.description,
    progressLine,
    streakLine: null,
    shareText: progressLine,
  };
}
