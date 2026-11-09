import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { fetchWeather } from '../utils/weather';

const PROMPT_SHOWN_KEY = '@habituate/locationPromptShown';
const CACHE_KEY = '@habituate/weatherCache';
const REFRESH_MS = 30 * 60 * 1000; // SKYLINE.md section 7: at most every 30 min

/** ~1km rounding (SKYLINE.md section 7) — never store or send exact
 * coordinates. 2 decimal degrees is ~1.1km of latitude, close enough. */
function roundCoord(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Orchestrates the Phase 2 weather pass: the one-time, plain-language-first
 * location prompt (fired by the screen after a successful floor build, not
 * on mount — SKYLINE.md section 5), permission state, coarse-coordinate
 * fetch/cache/refresh, and a hard fallback to null (clock-only sky) on any
 * failure — denied permission, offline, or the API erroring. Local to
 * whichever screen uses it; no cross-screen sync needed (contrast
 * useTapToBuild.js, which does).
 */
export function useWeatherSky() {
  const [needsLocationPrompt, setNeedsLocationPrompt] = useState(false);
  const [weather, setWeather] = useState(null); // { weatherCode, sunrise, sunset } | null
  const fetchingRef = useRef(false);

  const loadCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      return {
        ...cached,
        sunrise: cached.sunrise ? new Date(cached.sunrise) : null,
        sunset: cached.sunset ? new Date(cached.sunset) : null,
      };
    } catch {
      return null;
    }
  }, []);

  const refreshIfStale = useCallback(async () => {
    if (fetchingRef.current) return;
    const cached = await loadCache();
    if (cached) setWeather(cached);

    const fresh = cached && Date.now() - cached.fetchedAt < REFRESH_MS;
    if (fresh) return;

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return;

    fetchingRef.current = true;
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      const latitude = roundCoord(position.coords.latitude);
      const longitude = roundCoord(position.coords.longitude);
      const result = await fetchWeather({ latitude, longitude });
      const toCache = { ...result, latitude, longitude, fetchedAt: Date.now() };
      setWeather(toCache);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(toCache)).catch(() => {});
    } catch {
      // Offline or the API failed — keep whatever was cached (possibly
      // nothing), never block the sky on this. Clock-only sky still works.
    } finally {
      fetchingRef.current = false;
    }
  }, [loadCache]);

  useEffect(() => {
    AsyncStorage.getItem(PROMPT_SHOWN_KEY)
      .then((shown) => {
        if (shown !== 'true') setNeedsLocationPrompt(true);
      })
      .catch(() => {});
    refreshIfStale();
    const id = setInterval(refreshIfStale, REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshIfStale]);

  const requestLocation = useCallback(async () => {
    setNeedsLocationPrompt(false);
    AsyncStorage.setItem(PROMPT_SHOWN_KEY, 'true').catch(() => {});
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) refreshIfStale();
  }, [refreshIfStale]);

  const skipLocationPrompt = useCallback(() => {
    setNeedsLocationPrompt(false);
    AsyncStorage.setItem(PROMPT_SHOWN_KEY, 'true').catch(() => {});
  }, []);

  return {
    needsLocationPrompt,
    weatherCode: weather?.weatherCode ?? null,
    sunrise: weather?.sunrise ?? null,
    sunset: weather?.sunset ?? null,
    requestLocation,
    skipLocationPrompt,
  };
}
