import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

export function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** Consecutive days ending today, or ending yesterday if today is still open. */
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
  const enriched = {
    ...habit,
    checkIns,
    checkedInToday,
    streak: computeStreak(checkIns),
    lastCheckIn: checkIns[0] ? checkIns[0].occurredAt : null,
  };

  return { ...enriched, streakStatus: streakStatus(enriched) };
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

  const archiveHabit = useCallback((habitId) => run(() => api.archiveHabit(habitId)), [run]);

  const restoreHabit = useCallback((habitId) => run(() => api.restoreHabit(habitId)), [run]);

  const deleteHabit = useCallback((habitId) => run(() => api.deleteHabit(habitId)), [run]);

  const summary = useMemo(() => {
    const total = habits.length;
    const done = habits.filter((habit) => habit.checkedInToday).length;
    return {
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
      topStreak: total === 0 ? 0 : Math.max(...habits.map((habit) => habit.streak || 0)),
    };
  }, [habits]);

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
