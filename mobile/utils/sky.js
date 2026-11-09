/**
 * Pure mapping from local time (and, once Phase 2 wires location, weather) to
 * a sky kind for the skyline backdrop (SKYLINE.md section 7). No React, no
 * I/O, no clock reads — the caller passes `now`.
 */

export const SKY_KINDS = ['dawn', 'day', 'overcast', 'rain', 'snow', 'night'];

/**
 * Fixed fallback windows used when sunrise/sunset aren't known (no location
 * permission yet, or Phase 1/the dev screen, which doesn't wire location at
 * all). Dusk has no window of its own — it folds into night per SKYLINE.md
 * section 7 ("dusk folded into night 18 to 5").
 */
const FALLBACK_DAWN_START = 5;
const FALLBACK_DAY_START = 8;
const FALLBACK_NIGHT_START = 18;

function timeBasedKind(now, sunrise, sunset) {
  const hour = now.getHours() + now.getMinutes() / 60;

  if (sunrise instanceof Date && sunset instanceof Date) {
    const sunriseHour = sunrise.getHours() + sunrise.getMinutes() / 60;
    const sunsetHour = sunset.getHours() + sunset.getMinutes() / 60;
    const dawnStart = sunriseHour - 1;
    if (hour >= dawnStart && hour < sunriseHour) return 'dawn';
    if (hour >= sunriseHour && hour < sunsetHour) return 'day';
    return 'night';
  }

  if (hour >= FALLBACK_DAWN_START && hour < FALLBACK_DAY_START) return 'dawn';
  if (hour >= FALLBACK_DAY_START && hour < FALLBACK_NIGHT_START) return 'day';
  return 'night';
}

/**
 * Weather code taxonomy is deliberately loose (string match, case
 * insensitive) rather than tied to one provider's numeric codes — the
 * provider is still an open decision (SKYLINE.md section 14 #2), so this
 * stays provider-agnostic until Phase 2 picks one and adapts its codes to
 * this vocabulary at the call site.
 */
function weatherOverride(weatherCode) {
  if (!weatherCode) return null;
  const code = String(weatherCode).toLowerCase();
  if (/thunder|storm|drizzle|rain/.test(code)) return 'rain';
  if (/snow|sleet/.test(code)) return 'snow';
  if (/fog|mist|haze|cloud|overcast/.test(code)) return 'overcast';
  if (/clear|sun/.test(code)) return null; // defer to the time-based sky
  return null;
}

/**
 * @param {{ now: Date, sunrise?: Date, sunset?: Date, weatherCode?: string }} input
 * @returns {'dawn'|'day'|'overcast'|'rain'|'snow'|'night'}
 */
export function skyKind({ now, sunrise, sunset, weatherCode } = {}) {
  const at = now instanceof Date ? now : new Date();
  const base = timeBasedKind(at, sunrise, sunset);

  const override = weatherOverride(weatherCode);
  if (!override) return base;

  // Weather never overrides night — rain/snow/overcast at night still just
  // reads as night (no separate "rainy night" kind in the section 7 list).
  if (base === 'night') return 'night';
  return override;
}
