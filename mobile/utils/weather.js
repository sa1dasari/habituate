/**
 * Thin wrapper around Open-Meteo's free, keyless forecast API (SKYLINE.md
 * section 14 decision 2 — Option B, resolved 2026-11-09). Deliberately this
 * small and isolated so moving to Option A (a backend proxy, if the keyless
 * API ever gets rate-limited) is a one-file change — nothing else in the
 * app should import Open-Meteo directly.
 *
 * No API key, no auth. Coarse coordinates only — see utils/weather.js's
 * caller (hooks/useWeatherSky.js) for the ~1km rounding before a request
 * is ever made.
 */

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * @param {{ latitude: number, longitude: number }} coords
 * @returns {Promise<{ weatherCode: string, sunrise: Date, sunset: Date }>}
 */
export async function fetchWeather({ latitude, longitude }) {
  const url =
    `${BASE_URL}?latitude=${latitude}&longitude=${longitude}` +
    '&current=weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=1';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather request failed (${response.status})`);
  }
  const data = await response.json();

  const code = data?.current?.weather_code;
  const sunriseRaw = data?.daily?.sunrise?.[0];
  const sunsetRaw = data?.daily?.sunset?.[0];

  return {
    // utils/sky.js's skyKind() does a loose string match (rain/snow/cloud),
    // not Open-Meteo's numeric WMO codes directly — translate here so the
    // sky logic itself stays provider-agnostic.
    weatherCode: wmoCodeToKind(code),
    sunrise: sunriseRaw ? new Date(sunriseRaw) : null,
    sunset: sunsetRaw ? new Date(sunsetRaw) : null,
  };
}

/** WMO weather codes (Open-Meteo's own scheme) collapsed into the loose
 * vocabulary utils/sky.js's weatherOverride() already matches on. */
function wmoCodeToKind(code) {
  if (code == null) return null;
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3 || (code >= 45 && code <= 48)) return 'cloud';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95) return 'thunder';
  return null;
}
