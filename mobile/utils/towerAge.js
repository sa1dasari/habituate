const MS_PER_DAY = 86400000;

/**
 * When the habit's *current* tower segment started — the clock the server
 * gates Top out on (HabitService.topOutHabit measures from the open
 * segment's startedAt, not the habit's createdAt). A habit that has never
 * topped out is still on its first segment, which starts at createdAt; once
 * it has, the open segment started the moment the most recent one closed.
 * `recentClosedSegments` is oldest-first, so its last entry is the latest.
 */
export function currentSegmentStart(habit) {
  const closed = habit?.recentClosedSegments;
  if (Array.isArray(closed) && closed.length > 0) {
    const last = closed[closed.length - 1];
    if (last?.toppedOutAt) return new Date(last.toppedOutAt);
  }
  return habit?.createdAt ? new Date(habit.createdAt) : null;
}

/** Whole days since the current segment started — same rounding as the server's Duration.toDays(). */
export function currentSegmentAgeDays(habit, now = new Date()) {
  const start = currentSegmentStart(habit);
  if (!start) return 0;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY));
}
