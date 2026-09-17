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
