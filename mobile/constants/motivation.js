/**
 * Copy for the post-check-in banner. Every line celebrates the action that just
 * happened — none of it references missed days, and none of it is shown when a
 * check-in is undone.
 */
const GENERAL = [
  'Logged. That’s how it builds.',
  'Nice one — that’s another rep for future you.',
  'Done. Small steps, stacked.',
  'Checked in. Momentum looks good on you.',
  'That’s one more day of showing up.',
];

const ALL_DONE = [
  'Everything for today is logged. Enjoy the rest of it.',
  'That’s the whole list. Well played.',
  'All done for today — nothing left to chase.',
];

function pick(list, avoid) {
  const options = list.filter((line) => line !== avoid);
  const pool = options.length > 0 ? options : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * @param habit the habit that was just checked in
 * @param context.remaining habits still open today, after this check-in
 * @param context.avoid the previous message, so the banner doesn't repeat itself
 */
export function motivationMessage(habit = {}, context = {}) {
  const { remaining = null, avoid = null } = context;
  const target = Number(habit.periodTarget) || 1;

  if (target > 1) {
    const done = Math.min(target, (Number(habit.periodDone) || 0) + 1);
    const noun = habit.periodNoun || 'this period';
    return done >= target
      ? `${habit.name}: ${done} of ${target} ${noun} — target met.`
      : `${habit.name}: ${done} of ${target} ${noun}. Nicely on pace.`;
  }

  if (remaining === 0) return pick(ALL_DONE, avoid);
  if (remaining === 1) return 'Logged. Just one more habit whenever you’re ready.';

  return pick(GENERAL, avoid);
}
