export const colors = {
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

  flame: '#FB923C',
  ringTrack: '#E5E7EB',
};

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

export const typography = {
  screenTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  meta: { fontSize: 12, color: colors.textSecondary },
};

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

/**
 * Streak states are shared by personal and group streaks so the
 * anti-guilt palette stays consistent everywhere a streak is shown.
 */
export const streakStates = {
  safe: { label: 'On track', color: colors.safe, background: colors.safeSoft, icon: 'fire' },
  at_risk: { label: 'Pending today', color: colors.atRisk, background: colors.atRiskSoft, icon: 'clock-outline' },
  frozen: { label: 'Freeze used', color: colors.frozen, background: colors.frozenSoft, icon: 'snowflake' },
};

export function resolveStreakState(status) {
  const key = String(status || 'safe').replace(/-/g, '_');
  return streakStates[key] || streakStates.safe;
}
