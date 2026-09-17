/** Local-time date helpers. Everything here works in the device's timezone. */

export function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
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
