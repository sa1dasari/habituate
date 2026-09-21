import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  effectiveMonthlyTarget,
  effectiveWeeklyTarget,
  periodStart,
  previousPeriodStats,
} from '../utils/cadence';
import { toDateKey } from '../utils/date';

const STORAGE_KEY = '@habituate/dismissedGoalReviews';

function primaryPeriod(habit) {
  if (effectiveMonthlyTarget(habit) > 0) return 'MONTHLY';
  if (effectiveWeeklyTarget(habit) > 0) return 'WEEKLY';
  return null;
}

/**
 * A featured habit (one pinned into the Goals section) never needs a
 * rollover — its target just keeps recurring, the same as it always has.
 * What it's missing is a one-time nudge when a period closes: "10 of 12 last
 * month". This is computed entirely from check-ins the habit already has
 * (see previousPeriodStats in cadence.js) — the only new state is which
 * period-transitions have already been shown, tracked locally so it isn't
 * re-shown every time the app opens.
 */
export function useFeaturedGoalReviews(featuredHabits) {
  const [dismissed, setDismissed] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setDismissed(raw ? JSON.parse(raw) : {});
      })
      .catch(() => {
        if (!cancelled) setDismissed({});
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((habitId, periodKey) => {
    setDismissed((current) => {
      const next = { ...current, [habitId]: periodKey };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  if (!loaded) return { reviews: [], dismiss };

  const reviews = featuredHabits
    .map((habit) => {
      const period = primaryPeriod(habit);
      if (!period) return null;

      const currentKey = toDateKey(periodStart(period));
      if (dismissed[habit.id] === currentKey) return null;

      // No prior period of its own to review if the habit only exists this period.
      if (!habit.createdAt || toDateKey(new Date(habit.createdAt)) >= currentKey) return null;

      const stats = previousPeriodStats(habit);
      if (!stats) return null;

      return { habit, stats, currentKey };
    })
    .filter(Boolean);

  return { reviews, dismiss };
}
