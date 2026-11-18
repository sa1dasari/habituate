// Per-habit tower colour palette (design-review board 12). The backend stores
// the KEY (api TowerColors); hex values live here. `dark` is the board's hex;
// `light` is the same hue darkened until it reaches >= 3:1 contrast against
// the light skyline background (skylineUI.light.background #EAF0F7).
export const TOWER_COLOR_PALETTE = [
  { key: 'coral', label: 'Coral', dark: '#FF8A5B', light: '#DC6738' },
  { key: 'amber', label: 'Amber', dark: '#F2C14E', light: '#B1800D' },
  { key: 'lime', label: 'Lime', dark: '#84CC16', light: '#529A00' },
  { key: 'green', label: 'Green', dark: '#22C55E', light: '#009D36' },
  { key: 'teal', label: 'Teal', dark: '#14B8A6', light: '#009A88' },
  { key: 'cyan', label: 'Cyan', dark: '#22D3EE', light: '#0097B2' },
  { key: 'sky', label: 'Sky', dark: '#38BDF8', light: '#0B90CB' },
  { key: 'indigo', label: 'Indigo', dark: '#6366F1', light: '#6366F1' },
  { key: 'violet', label: 'Violet', dark: '#A78BFA', light: '#9377E6' },
  { key: 'pink', label: 'Pink', dark: '#EC4899', light: '#EC4899' },
  { key: 'rose', label: 'Rose', dark: '#F87171', light: '#E45D5D' },
  { key: 'slate', label: 'Slate', dark: '#8B95A5', light: '#7C8696' },
];

export const TOWER_COLOR_KEYS = TOWER_COLOR_PALETTE.map((c) => c.key);

const BY_KEY = Object.fromEntries(TOWER_COLOR_PALETTE.map((c) => [c.key, c]));

export function isTowerColorKey(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(BY_KEY, key);
}

/** Hex for a palette key in a mode ('dark' | 'light'), or null if unknown. */
export function towerColorHex(key, mode) {
  if (!isTowerColorKey(key)) return null;
  return BY_KEY[key][mode === 'light' ? 'light' : 'dark'];
}

/**
 * The colour a habit's tower / Insights series / lot uses: its picked palette
 * colour if it has a valid one, else its category colour from `categoryColors`
 * (theme.js buildCategoryTowerColors()[mode]). Falls back to 'Other', then
 * undefined if the map has neither.
 */
export function resolveHabitColor(habit, mode, categoryColors) {
  const picked = habit ? towerColorHex(habit.color, mode) : null;
  if (picked) return picked;
  const map = categoryColors || {};
  return (habit && map[habit.category]) || map.Other;
}
