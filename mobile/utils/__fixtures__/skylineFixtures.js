/**
 * Sample data for the Phase 1 dev screen and buildScene/skyKind tests
 * (SKYLINE.md section 11, Phase 1). `FIXTURE_TODAY` is fixed, not the real
 * clock, so renders and test assertions stay deterministic.
 */

export const FIXTURE_TODAY = new Date('2026-11-07T12:00:00');

function daysAgo(n, from = FIXTURE_TODAY) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rangeDaysAgo(startN, endN) {
  const out = [];
  for (let n = startN; n >= endN; n -= 1) out.push(daysAgo(n));
  return out;
}

// 1. Daily habit, ~20 days old, mostly set with a couple open days and one
// shield day, a live 6-day run, best run is the current one (ledge at top).
const dailyActive = {
  id: 'fx-run',
  name: 'Run',
  category: 'Fitness',
  cadenceType: 'DAILY',
  cadenceTarget: 1,
  trackingMode: 'BOOLEAN',
  startDate: daysAgo(20),
  checkInDays: rangeDaysAgo(20, 0).filter((d) => ![daysAgo(14), daysAgo(9)].includes(d)),
  shieldDays: [daysAgo(9)],
  currentRun: 6,
  bestRun: { length: 6, startDate: daysAgo(5), endDate: daysAgo(0) },
  state: 'active',
};

// 2. Weekly-target-only habit — no fixed per-day schedule, so only logged
// days get a floor; everything else is "not due" (no floor, no outline).
const weeklyTarget = {
  id: 'fx-gym',
  name: 'Gym',
  category: 'Health',
  cadenceType: 'WEEKLY',
  weeklyTarget: 3,
  trackingMode: 'BOOLEAN',
  startDate: daysAgo(18),
  checkInDays: [daysAgo(17), daysAgo(15), daysAgo(10), daysAgo(8), daysAgo(3), daysAgo(1)],
  shieldDays: [],
  currentRun: 2,
  bestRun: { length: 3, startDate: daysAgo(10), endDate: daysAgo(3) },
  state: 'active',
};

// 3. Topped out ~65 days ago (old enough per section 6), gold cap/flag.
const toppedOut = {
  id: 'fx-write',
  name: 'Write',
  category: 'Creativity',
  cadenceType: 'DAILY',
  cadenceTarget: 1,
  trackingMode: 'BOOLEAN',
  startDate: daysAgo(80),
  checkInDays: rangeDaysAgo(80, 15),
  shieldDays: [],
  currentRun: 0,
  bestRun: { length: 30, startDate: daysAgo(50), endDate: daysAgo(21) },
  state: 'topped_out',
};

// 4. Retired habit — grey monument, no new floors.
const monument = {
  id: 'fx-meditate',
  name: 'Meditate',
  category: 'Mindfulness',
  cadenceType: 'DAILY',
  cadenceTarget: 1,
  trackingMode: 'BOOLEAN',
  startDate: daysAgo(40),
  checkInDays: rangeDaysAgo(40, 25),
  shieldDays: [],
  currentRun: 0,
  bestRun: { length: 16, startDate: daysAgo(40), endDate: daysAgo(25) },
  state: 'monument',
};

// 5. Old enough (90 days) to exercise tier collapsing — more than 59 due
// days, so the oldest days fold into one tier block.
const tieredTower = {
  id: 'fx-sleep',
  name: 'Sleep by 11',
  category: 'Sleep',
  cadenceType: 'DAILY',
  cadenceTarget: 1,
  trackingMode: 'BOOLEAN',
  startDate: daysAgo(90),
  checkInDays: rangeDaysAgo(90, 0).filter((_, i) => i % 5 !== 0),
  shieldDays: [daysAgo(45)],
  currentRun: 4,
  bestRun: { length: 12, startDate: daysAgo(70), endDate: daysAgo(59) },
  state: 'active',
};

export const SKYLINE_FIXTURE_HABITS = [dailyActive, weeklyTarget, toppedOut, monument, tieredTower];
