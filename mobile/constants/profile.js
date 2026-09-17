/**
 * Placeholder identity for the demo user. Replaced by the Firebase Auth
 * profile in Phase 2 once sign-in lands — nothing else should hardcode a name.
 */
export const DISPLAY_NAME = 'Alex';

export function initials(name = DISPLAY_NAME) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
