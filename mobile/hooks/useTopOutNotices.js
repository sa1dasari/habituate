import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasDailyTarget } from '../utils/cadence';
import { towerCapInfo, towerKey } from '../utils/towerAge';

const WARNED_KEY = 'habituate.topOutWarned.v1';
const ANNOUNCED_KEY = 'habituate.topOutAnnounced.v1';
// The pop-up appears for the last three days before a tower's cap.
const WARN_WITHIN_DAYS = 3;

async function loadSet(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSet(key, set) {
  AsyncStorage.setItem(key, JSON.stringify([...set])).catch(() => {});
}

/**
 * What the Skyline should tell the user about tower caps (design-review
 * boards 52 and 55, SKYLINE.md section 6):
 *  - `announcement`: an automatic top-out the user hasn't been told about yet
 *    (a closed segment with `autoToppedOut`, remembered by segment id).
 *  - `warning`: a tower in the last three days before its cap, once per tower
 *    (remembered by habit id + that tower's start day, so the next tower
 *    after a top-out can warn again).
 * The announcement takes priority; only one is returned at a time. "Seen"
 * state lives on this device — a second device would show each notice once
 * more, which is acceptable and avoids server state for a courtesy message.
 */
export function useTopOutNotices(habits, enabled) {
  const [warned, setWarned] = useState(null);
  const [announced, setAnnounced] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSet(WARNED_KEY), loadSet(ANNOUNCED_KEY)]).then(([w, a]) => {
      if (cancelled) return;
      setWarned(w);
      setAnnounced(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const announcement = useMemo(() => {
    if (!enabled || !announced) return null;
    for (const habit of habits) {
      const closed = habit.recentClosedSegments || [];
      for (let i = closed.length - 1; i >= 0; i -= 1) {
        const segment = closed[i];
        if (segment.autoToppedOut && !announced.has(String(segment.id))) {
          return { habit, segment };
        }
      }
    }
    return null;
  }, [habits, enabled, announced]);

  const warning = useMemo(() => {
    if (!enabled || !warned) return null;
    for (const habit of habits) {
      if (habit.archived || !hasDailyTarget(habit)) continue;
      const info = towerCapInfo(habit);
      // daysStood >= 1: a brand-new tower with a tiny cap isn't warned the
      // moment it is created.
      if (info.daysStood >= 1 && info.daysToGo >= 1 && info.daysToGo <= WARN_WITHIN_DAYS && !warned.has(towerKey(habit))) {
        return { habit, ...info };
      }
    }
    return null;
  }, [habits, enabled, warned]);

  const markWarned = useCallback((habit) => {
    setWarned((prev) => {
      const next = new Set(prev || []);
      next.add(towerKey(habit));
      saveSet(WARNED_KEY, next);
      return next;
    });
  }, []);

  const markAnnounced = useCallback((segment) => {
    setAnnounced((prev) => {
      const next = new Set(prev || []);
      next.add(String(segment.id));
      saveSet(ANNOUNCED_KEY, next);
      return next;
    });
  }, []);

  return { warning, announcement, markWarned, markAnnounced };
}
