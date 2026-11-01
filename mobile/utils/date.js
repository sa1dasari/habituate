/** Local-time date helpers. Everything here works in the device's timezone. */

export function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** Whole days between today and a 'YYYY-MM-DD' date string — positive for a future
 * date, negative for a past one. Parses with an explicit local midnight (not a bare
 * `new Date(dateString)`, which Date treats as UTC and can land on the wrong day in
 * negative-offset timezones). */
export function daysUntil(dateString, now = new Date()) {
  const target = new Date(`${dateString}T00:00:00`);
  const today = startOfDay(now);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** Short human date for a 'YYYY-MM-DD' string, e.g. "Oct 15" — never a bare ISO string. */
export function formatShortDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Challenge/goal-style deadline framing for a nullable period end — "N days left",
 * "Ends today", "Ended N days ago", or "Open-ended" when there's no end date at all.
 * Always something a reader parses at a glance, never a raw date range. */
export function formatDeadline(periodEnd) {
  if (!periodEnd) return 'Open-ended';
  const days = daysUntil(periodEnd);
  if (days > 1) return `${days} days left`;
  if (days === 1) return '1 day left';
  if (days === 0) return 'Ends today';
  if (days === -1) return 'Ended yesterday';
  return `Ended ${Math.abs(days)} days ago`;
}

export function startOfDay(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Weeks start on Monday, so "3 days this week" resets with the work week. */
export function startOfWeek(value = new Date()) {
  const date = startOfDay(value);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  return date;
}

export function startOfMonth(value = new Date()) {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

export function daysInMonth(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Days left in the current week, today included. */
export function daysLeftInWeek(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return 7 - ((date.getDay() + 6) % 7);
}

/** Days left in the current month, today included. */
export function daysLeftInMonth(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return daysInMonth(date) - date.getDate() + 1;
}

/** "2h ago" / "3d ago" style relative label, for feed-style timestamps. */
export function timeAgo(value, now = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));

  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}
