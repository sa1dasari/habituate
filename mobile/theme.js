export const lightColors = {
  background: '#F5F6F8',
  surface: '#FFFFFF',
  border: '#E5E7EB',

  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  accent: '#2563EB',
  accentSoft: '#DBEAFE',

  safe: '#047857',
  safeSoft: '#ECFDF5',

  atRisk: '#C2410C',
  atRiskSoft: '#FFF7ED',

  frozen: '#3730A3',
  frozenSoft: '#EEF2FF',

  warning: '#B45309',
  warningSoft: '#FFFBEB',

  neutralSoft: '#F3F4F6',

  ringTrack: '#E5E7EB',
};

export const darkColors = {
  background: '#0B0F17',
  surface: '#161B26',
  border: '#262D3B',

  textPrimary: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',

  accent: '#60A5FA',
  accentSoft: '#1E3A5F',

  safe: '#34D399',
  safeSoft: '#0B3B2E',

  atRisk: '#FB923C',
  atRiskSoft: '#3F220D',

  frozen: '#A5B4FC',
  frozenSoft: '#211E52',

  warning: '#FBBF24',
  warningSoft: '#3F2D06',

  neutralSoft: '#1F2430',

  ringTrack: '#262D3B',
};

/** Default export for any code that hasn't switched to useAppTheme() yet — always the light palette. */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

/**
 * Nunito, loaded via @expo-google-fonts/nunito (see App.js's useFonts call).
 * Each weight is its own static font file — set fontFamily only, never
 * fontWeight alongside it, or Android may ignore the custom font and fall
 * back to a synthetic bold on the system font instead.
 */
export const fonts = {
  regular: 'Nunito_400Regular',
  semiBold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
};

/** Text colors depend on the active palette, so typography is built per-mode by useAppTheme(). */
export function buildTypography(themeColors) {
  return {
    screenTitle: { fontFamily: fonts.extraBold, fontSize: 26, color: themeColors.textPrimary },
    sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: themeColors.textPrimary },
    cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: themeColors.textPrimary },
    body: { fontFamily: fonts.regular, fontSize: 14, color: themeColors.textPrimary },
    label: { fontFamily: fonts.semiBold, fontSize: 13, color: themeColors.textSecondary },
    meta: { fontFamily: fonts.regular, fontSize: 12, color: themeColors.textSecondary },
  };
}

/** Default (light) typography for any code that hasn't switched to useAppTheme() yet. */
export const typography = buildTypography(lightColors);

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

/** Heavier tier for hero moments (Today's summary card, the celebration
 * card) so everyday cards don't all sit at the same visual weight. */
export const shadowLg = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};

/**
 * Gradient pairs for hero accents — progress rings, bars, the flame, the
 * celebration card. Two stops each, used with expo-linear-gradient or an
 * SVG <LinearGradient> depending on the shape. Brand gradients stay the same
 * across light/dark — they're accent colors, not surface colors.
 */
export const gradients = {
  accent: ['#2563EB', '#7C3AED'],
  safe: ['#10B981', '#047857'],
  warm: ['#FBBF24', '#EA580C'],
};

/**
 * Flame color scales with streak length — a fresh streak reads as a small
 * ember, a long one as something worth protecting. Stops are [from, to] for
 * a bottom-to-top gradient.
 */
export const flameTiers = [
  { min: 0, stops: ['#FDE68A', '#FB923C'] },
  { min: 7, stops: ['#FB923C', '#EA580C'] },
  { min: 30, stops: ['#F97316', '#DC2626'] },
  { min: 100, stops: ['#DC2626', '#7C3AED'] },
];

export function flameStopsForStreak(streak = 0) {
  let tier = flameTiers[0];
  for (const candidate of flameTiers) {
    if (streak >= candidate.min) tier = candidate;
  }
  return tier.stops;
}

/**
 * Streak states are shared by personal and group streaks so the
 * anti-guilt palette stays consistent everywhere a streak is shown.
 * Built per-mode since the colors it references change with the palette.
 */
export function buildStreakStates(themeColors) {
  return {
    safe: { label: 'On track', color: themeColors.safe, background: themeColors.safeSoft, icon: 'fire' },
    at_risk: {
      label: 'Pending today',
      color: themeColors.atRisk,
      background: themeColors.atRiskSoft,
      icon: 'clock-outline',
    },
    frozen: {
      label: 'Freeze used',
      color: themeColors.frozen,
      background: themeColors.frozenSoft,
      icon: 'snowflake',
    },
  };
}

/** Default (light) streak states for any code that hasn't switched to useAppTheme() yet. */
export const streakStates = buildStreakStates(lightColors);

export function resolveStreakState(status, states = streakStates) {
  const key = String(status || 'safe').replace(/-/g, '_');
  return states[key] || states.safe;
}

// ─── Skyline (SKYLINE.md) ──────────────────────────────────────────────────
//
// A separate token namespace, not a change to lightColors/darkColors above —
// the skyline rebuild has its own dark-mode-first design (design/skyline/)
// and its own tower-face contrast needs. First-draft light values here are
// an open decision per SKYLINE.md section 14 #7: derived now, meant to be
// reviewed against an actual render, not pre-approved hex.

function hexShade(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Dark values are the design/skyline/ mockups' own UI base (SKYLINE.md
 * section 8). Light is a first-draft derived counterpart. */
export const skylineUI = {
  dark: {
    background: '#0F1216',
    surfaceLow: '#161B21',
    surfaceHigh: '#1E252D',
    text: '#F2F4F6',
    muted: '#A3ADB8',
    amber: '#F2C14E',
  },
  light: {
    background: '#EAF0F7',
    surfaceLow: '#FFFFFF',
    surfaceHigh: '#F3F6FA',
    text: '#15202B',
    muted: '#5B6B7A',
    amber: '#B45309',
  },
};

/**
 * Tower rendering tokens that aren't per-category (open-floor void, shield
 * block, crane, monument, best-run ledge, windows). Per
 * concept_screens/tower_floor_states_windows_and_shield.png: a real
 * check-in always draws windows (windowLit inside the current run,
 * windowDark once the run has passed it) — that presence/absence is the
 * primary non-color signal (section 13), color is secondary. Shield Days
 * are a flat shieldFill block with no windows at all, never the category
 * color. An open floor is a transparent cutout — its outline (openStroke) is
 * drawn but its fill is 'none', so the sky shows through, not a solid void.
 * That keeps CLAUDE.md's "no hole, no dark gap" rule: the floor's full
 * outline and height are always present, just see-through, so it reads as
 * "not built yet" rather than damage or a missing floor.
 */
export const skylineTowerTheme = {
  dark: {
    openStroke: '#5B6472',
    shieldFill: '#5B7083',
    windowLit: '#FFE9B0',
    windowDark: '#6B4A38',
    tierLine: '#3A4552',
    monumentOverlay: 'rgba(163,173,184,0.55)',
    craneColor: '#A3ADB8',
    flagColor: '#F2C14E',
    ledgeColor: '#F2F4F6',
    // Phase 3d compositing (SKYLINE.md section 6): the faded closed
    // segments stacked behind the active tower — a flat muted-brown block,
    // never the category color, same "distinct from every live state"
    // treatment shieldFill gets.
    closedSegmentFill: '#6B5A4A',
  },
  light: {
    openStroke: '#9AA7B5',
    shieldFill: '#8FA3B8',
    windowLit: '#FFE9B0',
    windowDark: '#8A6652',
    tierLine: '#C7D1DB',
    monumentOverlay: 'rgba(91,107,122,0.4)',
    craneColor: '#5B6B7A',
    flagColor: '#B45309',
    ledgeColor: '#15202B',
    closedSegmentFill: '#A0876E',
  },
};

/**
 * Two-stop (top-to-bottom) gradients per sky kind (SKYLINE.md section 7/2
 * mockup 5). Light variants are deliberately less saturated than a literal
 * daytime photo would be, so a bright sky doesn't fight the app's light
 * chrome around it — first-draft, same review note as skylineUI.light.
 */
export const skyGradients = {
  dark: {
    dawn: ['#241B33', '#8C5B75'],
    day: ['#1B2838', '#3E6490'],
    overcast: ['#232A33', '#3E4750'],
    rain: ['#1A2027', '#323B46'],
    snow: ['#232B36', '#4A5A6B'],
    night: ['#0B0F17', '#1B2330'],
  },
  light: {
    dawn: ['#FBD9C4', '#F3A6B4'],
    day: ['#AFD8F5', '#EAF6FF'],
    overcast: ['#C7D1DB', '#E4E9EF'],
    rain: ['#A9B6C2', '#D3DBE2'],
    snow: ['#D7E3EE', '#F3F7FB'],
    night: ['#1B2330', '#3A4552'],
  },
};

/**
 * Per-category tower-face color, light and dark. Derived from the existing
 * HABIT_CATEGORY_COLORS hue (so a Fitness tower matches its icon tile
 * elsewhere in the app) rather than a hand-picked second list — dark keeps
 * the category hex as-is (already close to the mockup's saturated sample
 * towers), light is darkened for the ~3:1 contrast section 8 asks for
 * against a light sky. Pass a HABIT_CATEGORY_COLORS map in; kept out of
 * this module to avoid a constants/ -> theme.js import for one function.
 */
// Home and Digital Wellbeing's category hex are dark, muted tones that read
// under the 3:1 section 8 target against a night sky as-is (measured 2.23
// and 2.08) — brightened for the dark tower variant only; their icon tiles
// elsewhere in the app are untouched.
const DARK_TOWER_BRIGHTEN = { Home: 40, 'Digital Wellbeing': 40 };

export function buildCategoryTowerColors(categoryColors) {
  const dark = {};
  const light = {};
  Object.entries(categoryColors).forEach(([category, hex]) => {
    const brighten = DARK_TOWER_BRIGHTEN[category];
    dark[category] = brighten ? hexShade(hex, brighten) : hex;
    light[category] = hexShade(hex, -40);
  });
  return { dark, light };
}
