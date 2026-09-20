import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { cadenceProgress } from '../utils/cadence';
import { toDateKey } from '../utils/date';

export { toDateKey };

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

  const createHabit = useCallback((habit) => run(() => api.createHabit(habit)), [run]);

  const updateHabit = useCallback(
    (habitId, changes) => run(() => api.updateHabit(habitId, changes)),
    [run]
  );

  // BOOLEAN habits only: today is either logged or not, so a second tap undoes it.
  const toggleCheckIn = useCallback(
    (habitId) =>
      run(async () => {
        const habit = habits.find((item) => item.id === habitId);
        if (!habit) return;

        const today = toDateKey(new Date());
        const todays = habit.checkIns.find((checkIn) => toDateKey(checkIn.occurredAt) === today);

        if (todays) {
          await api.deleteCheckIn(todays.id);
        } else {
          await api.createCheckIn(habitId);
        }
      }),
    [habits, run]
  );

  // COUNT habits: every tap (or a batch amount) adds a new check-in — today can
  // hold any number of them, e.g. two gym visits or five job applications.
  const addCheckIn = useCallback(
    (habitId, value = 1) => run(() => api.createCheckIn(habitId, { value, source: 'manual' })),
    [run]
  );

  // Undoes the single most recent check-in logged today, not the whole day.
  const removeLastCheckIn = useCallback(
    (habitId) =>
      run(async () => {
        const habit = habits.find((item) => item.id === habitId);
        if (!habit) return;

        const today = toDateKey(new Date());
        const todays = habit.checkIns
          .filter((checkIn) => toDateKey(checkIn.occurredAt) === today)
          .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

        if (todays[0]) {
          await api.deleteCheckIn(todays[0].id);
        }
      }),
    [habits, run]
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
