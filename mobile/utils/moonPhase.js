/**
 * Pure, dependency-free moon phase approximation for the night sky backdrop
 * (SKYLINE.md section 7). Based on days since a known new moon and the
 * ~29.53-day synodic month — accurate to roughly a day, which is plenty for
 * a decorative sky. No React, no I/O, no clock reads — the caller passes
 * `date`.
 *
 * Deliberately does not attempt a "blood moon" (lunar eclipse) phase: real
 * eclipses are rare, specific calendar dates that need real ephemeris data,
 * not something to fake from a phase calculation. Out of scope here.
 */

const SYNODIC_MONTH_DAYS = 29.530588853;
// A known new moon reference point (2000-01-06 18:14 UTC).
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
const MS_PER_DAY = 86400000;

export const MOON_PHASES = [
  'new',
  'waxingCrescent',
  'firstQuarter',
  'waxingGibbous',
  'full',
  'waningGibbous',
  'lastQuarter',
  'waningCrescent',
];

/** @returns {number} days since the last new moon, 0..SYNODIC_MONTH_DAYS */
export function moonAge(date) {
  const diffDays = (date.getTime() - KNOWN_NEW_MOON_MS) / MS_PER_DAY;
  const age = diffDays % SYNODIC_MONTH_DAYS;
  return age < 0 ? age + SYNODIC_MONTH_DAYS : age;
}

/**
 * @param {Date} date
 * @returns {{ phase: string, fraction: number, illumination: number, waxing: boolean }}
 *   fraction: 0..1 position through the cycle. illumination: 0 (new) to 1
 *   (full) to 0, the fraction of the disc that reads as lit.
 */
export function moonPhase(date = new Date()) {
  const age = moonAge(date);
  const fraction = age / SYNODIC_MONTH_DAYS;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const waxing = fraction < 0.5;

  let phase;
  if (fraction < 0.03 || fraction >= 0.97) phase = 'new';
  else if (fraction < 0.22) phase = 'waxingCrescent';
  else if (fraction < 0.28) phase = 'firstQuarter';
  else if (fraction < 0.47) phase = 'waxingGibbous';
  else if (fraction < 0.53) phase = 'full';
  else if (fraction < 0.72) phase = 'waningGibbous';
  else if (fraction < 0.78) phase = 'lastQuarter';
  else phase = 'waningCrescent';

  return { phase, fraction, illumination, waxing };
}
