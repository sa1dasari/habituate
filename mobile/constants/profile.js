/**
 * Fallback only — every screen now reads the real name from useAuth()'s
 * Firebase user (displayName). This covers the case where that's unset
 * (e.g. an email/password account that never set one).
 */
export const DISPLAY_NAME = 'there';

export function initials(name = DISPLAY_NAME) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
