import { toSceneHabit } from './skylineAdapter';
import { toDateKey } from './date';

/**
 * Builds a scene-shaped habit for the share card (boards 80/81): the real
 * tower's color/category/bestRun/state come from toSceneHabit as usual, but
 * checkInDays is synthesized as one consecutive, gap-free run ending today
 * — per the approved design, a share card never draws an open or missed
 * floor, and carries no real check-in dates. Reusing buildScene/SkylineTower
 * on top of this (rather than a separate drawing routine) is what makes the
 * card actually match the in-app tower's look (window pips, best-run ledge,
 * gold cap/flag) instead of a hand-drawn approximation.
 */
export function buildShareSceneHabit(habit, categoryColors, mode, today = new Date()) {
  const sceneHabit = toSceneHabit(habit, categoryColors, mode);
  const run = Math.max(sceneHabit.currentRun, 1);

  const checkInDays = [];
  for (let i = 0; i < run; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    checkInDays.push(toDateKey(d));
  }
  const startDate = checkInDays[checkInDays.length - 1];

  return {
    ...sceneHabit,
    startDate,
    checkInDays,
    shieldDays: [], // no glass floors on the card either — same "no gaps drawn" rule
  };
}
