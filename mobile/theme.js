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
