/**
 * Habit times are stored as a plain "HH:mm" string — a time of day with no
 * date attached — and shown to the user in 12-hour form.
 */

/** "HH:mm" -> a Date carrying that time (today's date, ignored by callers). Falls back to now. */
export function timeStringToDate(value) {
  const match = value ? String(value).match(/^(\d{1,2}):(\d{2})/) : null;
  const date = new Date();
  if (match) {
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  }
  return date;
}

/** A Date's clock time -> "HH:mm". */
export function dateToTimeString(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "08:00" -> "8:00 AM". Returns '' for a missing or unparseable value. */
export function formatTime(value) {
  if (!value) return '';

  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';

  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23 || Number(minutes) > 59) return '';

  const meridiem = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${minutes} ${meridiem}`;
}

/** A logged timestamp as "8:14 AM". */
export function formatClockTime(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return formatTime(
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  );
}

/** "Today", "Yesterday", or "Mon 14" for anything older. */
export function formatDayLabel(value, now = new Date()) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const dayDiff = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
      new Date(date.getFullYear(), date.getMonth(), date.getDate())) /
      86400000
  );

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';

  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

/** Habits with a scheduled time come first, in clock order; the rest keep their order. */
export function byScheduledTime(a, b) {
  const timeA = a && a.scheduledTime ? a.scheduledTime : null;
  const timeB = b && b.scheduledTime ? b.scheduledTime : null;

  if (timeA && timeB) return timeA.localeCompare(timeB);
  if (timeA) return -1;
  if (timeB) return 1;
  return 0;
}
