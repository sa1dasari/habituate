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
