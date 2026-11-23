import { isReviewMilestone } from './reviewPrompt';

describe('isReviewMilestone', () => {
  test('true for a streak-milestone payload', () => {
    expect(isReviewMilestone({ key: 'milestone-streak-3-7', variant: 'milestone', streak: 7 })).toBe(true);
  });

  test('false for a habit-target-met payload, even with a nonzero streak', () => {
    expect(isReviewMilestone({ key: 'milestone-habit-3-123456', variant: 'milestone', streak: 5 })).toBe(false);
  });

  test('false for null/undefined/missing key', () => {
    expect(isReviewMilestone(null)).toBe(false);
    expect(isReviewMilestone(undefined)).toBe(false);
    expect(isReviewMilestone({ variant: 'milestone', streak: 7 })).toBe(false);
  });
});
