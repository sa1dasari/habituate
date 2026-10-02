import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { cadenceProgress } from '../utils/cadence';
import { toDateKey } from '../utils/date';

export { toDateKey };

/**
 * Local noon for a backdated check-in. The actual hour doesn't matter for
 * correctness — the backend now buckets a check-in's day in the client's own
 * zone (the X-Timezone header the api client already sends on every
 * request), matching whatever local day this instant falls on. Noon just
 * keeps the stored timestamp looking sensible rather than landing on a
 * calendar-day edge.
 */
function instantForDayKey(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

/**
 * Kept for local fallback only — the authoritative values come from the API
 * (currentStreak / longestStreak on each HabitResponse).
 */
export function computeStreak(checkIns) {
  if (!checkIns || checkIns.length === 0) return 0;

  const days = new Set(checkIns.map((checkIn) => toDateKey(checkIn.occurredAt)));
  const cursor = new Date();

  if (!days.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/**
 * A streak is never shown as broken. If today's check-in is still outstanding
 * on an active streak it reads as "at risk", which is a prompt, not a penalty.
 */
export function streakStatus(habit) {
  if (habit.frozen) return 'frozen';
  if (habit.streak > 0 && !habit.checkedInToday) return 'at_risk';
  return 'safe';
}

async function hydrate(habit) {
  let checkIns = [];
  try {
    checkIns = (await api.listCheckIns(habit.id)) || [];
  } catch {
    checkIns = [];
  }

  const today = toDateKey(new Date());
  const checkedInToday = checkIns.some((checkIn) => toDateKey(checkIn.occurredAt) === today);
  // currentStreak and longestStreak come from the server; fall back to
  // client-side computation only if the API is older and omits them.
  const serverStreak = habit.currentStreak != null ? habit.currentStreak : computeStreak(checkIns);
  const enriched = {
    ...habit,
    checkIns,
    checkedInToday,
    streak: serverStreak,
    longestStreak: habit.longestStreak != null ? habit.longestStreak : serverStreak,
    lastCheckIn: checkIns[0] ? checkIns[0].occurredAt : null,
  };

  return {
    ...enriched,
    ...cadenceProgress(enriched),
    streakStatus: streakStatus(enriched),
  };
}

/** Check-in progress for any slice of habits — today's daily list, a cadence group, etc. */
export function summarizeHabits(list = []) {
  const total = list.length;
  const done = list.filter((habit) => habit.checkedInToday).length;

  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    topStreak: total === 0 ? 0 : Math.max(...list.map((habit) => habit.streak || 0)),
  };
}

const HabitsContext = createContext(null);

export function HabitsProvider({ children }) {
  const [habits, setHabits] = useState([]);
  const [archivedHabits, setArchivedHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [active, archived] = await Promise.all([
        api.listHabits(),
        api.listArchivedHabits(),
      ]);
      setHabits(await Promise.all((active || []).map(hydrate)));
      setArchivedHabits(archived || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load habits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = useCallback(
    async (action) => {
      setBusy(true);
      try {
        await action();
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  // `busy` alone isn't enough to stop a double-fire from racing itself: it's
  // React state, so there's a render-timing gap between a tap starting and
  // the button actually becoming disabled. A fast double-tap (or a Pressable
  // double-fire) landing in that gap reads the *same* stale habit.checkIns
  // snapshot twice — e.g. tap 1 creates a check-in, tap 2 (also seeing "not
  // checked in yet") creates again or, once its own stale closure thinks
  // it's now checked, deletes what tap 1 just created — silently reverting
  // the checkmark even though the first tap's celebration already fired.
  // This ref is checked synchronously, before any state update, so a second
  // invocation for the same habit while one is still in flight is simply
  // ignored instead of racing it.
  const pendingHabitIds = useRef(new Set());

  const runExclusive = useCallback(
    (habitId, action) => {
      if (pendingHabitIds.current.has(habitId)) {
        return Promise.resolve();
      }
      pendingHabitIds.current.add(habitId);
      return run(action).finally(() => {
        pendingHabitIds.current.delete(habitId);
      });
    },
    [run]
  );

  const createHabit = useCallback((habit) => run(() => api.createHabit(habit)), [run]);

  const updateHabit = useCallback(
    (habitId, changes) => run(() => api.updateHabit(habitId, changes)),
    [run]
  );

  // BOOLEAN habits only: a given day is either logged or not, so toggling an
  // already-logged day undoes it. Defaults to today; pass a 'YYYY-MM-DD' key
  // (e.g. from the calendar's day-detail panel) to toggle a past day instead.
  const toggleCheckIn = useCallback(
    (habitId, dayKey = toDateKey(new Date())) =>
      runExclusive(habitId, async () => {
        const habit = habits.find((item) => item.id === habitId);
        if (!habit) return;

        const existing = habit.checkIns.find((checkIn) => toDateKey(checkIn.occurredAt) === dayKey);

        try {
          if (existing) {
            await api.deleteCheckIn(existing.id);
          } else if (dayKey === toDateKey(new Date())) {
            await api.createCheckIn(habitId);
          } else {
            await api.createCheckIn(habitId, {
              value: 1,
              source: 'manual',
              occurredAt: instantForDayKey(dayKey),
            });
          }
        } catch (err) {
          // Our local snapshot of this habit's check-ins can be a beat behind
          // the server (a fast double-tap landing before `busy` disables the
          // button, or two screens racing on the same habit). A 409 on
          // create ("already checked in") or a 404 on delete ("already
          // removed") both mean the desired end state already holds — not a
          // real failure. refresh() right after this picks up the true
          // state regardless, so just don't surface a scary error for it.
          const alreadyInDesiredState =
            (!existing && err?.status === 409) || (existing && err?.status === 404);
          if (!alreadyInDesiredState) throw err;
        }
      }),
    [habits, runExclusive]
  );

  // COUNT habits: every tap (or a batch amount) adds a new check-in — a day can
  // hold any number of them, e.g. two gym visits or five job applications.
  // Defaults to today; pass a 'YYYY-MM-DD' key to log against a past day.
  // Unlike toggleCheckIn, this never branches on stale local state (it always
  // just creates), so — unlike toggle — concurrent calls for the same habit
  // are safe here; COUNT habits legitimately need rapid repeated taps (5
  // quick taps for 5 reps) to all land, not get dropped by an exclusive lock.
  const addCheckIn = useCallback(
    (habitId, value = 1, dayKey = toDateKey(new Date())) =>
      run(() => {
        const isToday = dayKey === toDateKey(new Date());
        return api.createCheckIn(habitId, {
          value,
          source: 'manual',
          ...(isToday ? {} : { occurredAt: instantForDayKey(dayKey) }),
        });
      }),
    [run]
  );

  // Undoes the single most recent check-in logged today, not the whole day.
  const removeLastCheckIn = useCallback(
    (habitId) =>
      runExclusive(habitId, async () => {
        const habit = habits.find((item) => item.id === habitId);
        if (!habit) return;

        const today = toDateKey(new Date());
        const todays = habit.checkIns
          .filter((checkIn) => toDateKey(checkIn.occurredAt) === today)
          .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

        if (todays[0]) {
          try {
            await api.deleteCheckIn(todays[0].id);
          } catch (err) {
            // Already gone (e.g. a race with another remove) — same
            // desired-state-already-holds case as toggleCheckIn above.
            if (err?.status !== 404) throw err;
          }
        }
      }),
    [habits, runExclusive]
  );

  const archiveHabit = useCallback((habitId) => run(() => api.archiveHabit(habitId)), [run]);

  const restoreHabit = useCallback((habitId) => run(() => api.restoreHabit(habitId)), [run]);

  const deleteHabit = useCallback((habitId) => run(() => api.deleteHabit(habitId)), [run]);

  const summary = useMemo(() => summarizeHabits(habits), [habits]);

  const value = useMemo(
    () => ({
      habits,
      archivedHabits,
      loading,
      busy,
      error,
      summary,
      refresh,
      createHabit,
      updateHabit,
      toggleCheckIn,
      addCheckIn,
      removeLastCheckIn,
      archiveHabit,
      restoreHabit,
      deleteHabit,
    }),
    [
      habits,
      archivedHabits,
      loading,
      busy,
      error,
      summary,
      refresh,
      createHabit,
      updateHabit,
      toggleCheckIn,
      addCheckIn,
      removeLastCheckIn,
      archiveHabit,
      restoreHabit,
      deleteHabit,
    ]
  );

  return createElement(HabitsContext.Provider, { value }, children);
}

export function useHabits() {
  const context = useContext(HabitsContext);
  if (!context) {
    throw new Error('useHabits must be used inside a HabitsProvider');
  }
  return context;
}
