/** Fixed category list so habits group consistently across screens and insights. */
export const HABIT_CATEGORIES = [
  'Health',
  'Fitness',
  'Nutrition',
  'Sleep',
  'Mindfulness',
  'Productivity',
  'Learning',
  'Career',
  'Finance',
  'Creativity',
  'Social',
  'Home',
  'Digital Wellbeing',
  'Other',
];

export const HABIT_CATEGORY_OPTIONS = HABIT_CATEGORIES.map((category) => ({
  value: category,
  label: category,
}));

export const DEFAULT_HABIT_CATEGORY = 'Health';

/** MaterialCommunityIcons glyph per category, used by the habit card icon tile. */
export const HABIT_CATEGORY_ICONS = {
  Health: 'heart-pulse',
  Fitness: 'dumbbell',
  Nutrition: 'food-apple-outline',
  Sleep: 'weather-night',
  Mindfulness: 'meditation',
  Productivity: 'clipboard-check-outline',
  Learning: 'book-open-outline',
  Career: 'briefcase-outline',
  Finance: 'wallet-outline',
  Creativity: 'palette-outline',
  Social: 'account-group-outline',
  Home: 'home-outline',
  'Digital Wellbeing': 'cellphone-lock',
  Other: 'star-outline',
};

export function categoryIcon(category) {
  return HABIT_CATEGORY_ICONS[category] || HABIT_CATEGORY_ICONS.Other;
}

/**
 * One accent hex per category, used to tint a habit's icon tile (see
 * HabitCard.js) the same way ChallengeCard already tints its icon badge by
 * the challenge's own color — a static hex per category rather than a
 * theme.js token, matching the flat-hex convention CreateChallengeModal's
 * own COLOR_OPTIONS already uses. Picked to stay distinct from each other
 * and from the app's existing semantic colors (accent/safe/atRisk/frozen).
 */
export const HABIT_CATEGORY_COLORS = {
  Health: '#EF4444',
  Fitness: '#F97316',
  Nutrition: '#65A30D',
  Sleep: '#6366F1',
  Mindfulness: '#8B5CF6',
  Productivity: '#0EA5E9',
  Learning: '#14B8A6',
  Career: '#0891B2',
  Finance: '#059669',
  Creativity: '#DB2777',
  Social: '#F59E0B',
  Home: '#92400E',
  'Digital Wellbeing': '#475569',
  Other: '#6B7280',
};

export function categoryColor(category) {
  return HABIT_CATEGORY_COLORS[category] || HABIT_CATEGORY_COLORS.Other;
}
