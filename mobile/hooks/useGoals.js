import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { periodStart } from '../utils/cadence';
import { toDateKey } from '../utils/date';

/** The "YYYY-MM-DD" key for the start of the current week/month, client-local. */
function currentPeriodStartKey(period, now = new Date()) {
  return toDateKey(periodStart(period, now));
}

function hydrateGoal(goal, now = new Date()) {
  const currentKey = currentPeriodStartKey(goal.period, now);
  const target = goal.targetCount || 1;
  return {
    ...goal,
    percent: Math.min(100, Math.round((goal.currentCount / target) * 100)),
    complete: goal.currentCount >= target,
    // True once the client's own "this week/month" has moved past the period
    // this goal is still tracking — it needs a review before it can continue.
    needsReview: goal.periodStart !== currentKey,
    currentPeriodStartKey: currentKey,
  };
}

const GoalsContext = createContext(null);

export function GoalsProvider({ children }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.listGoals();
      setGoals((list || []).map((g) => hydrateGoal(g)));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load goals');
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

  const createGoal = useCallback(
    ({ description, period, targetCount }) =>
      run(() =>
        api.createGoal({
          description,
          period,
          targetCount,
          periodStart: currentPeriodStartKey(period),
        })
      ),
    [run]
  );

  const updateGoal = useCallback((goalId, changes) => run(() => api.updateGoal(goalId, changes)), [run]);

  const increment = useCallback((goalId) => run(() => api.adjustGoalProgress(goalId, 1)), [run]);

  const decrement = useCallback((goalId) => run(() => api.adjustGoalProgress(goalId, -1)), [run]);

  // Logs a specific amount in one go — e.g. "+50" toward a $500 goal — instead
  // of tapping +1 fifty times. `amount` is signed: negative removes progress.
  const logAmount = useCallback(
    (goalId, amount) => run(() => api.adjustGoalProgress(goalId, amount)),
    [run]
  );

  // Starts the goal's next period fresh (same description/target, count reset to 0).
  const rollover = useCallback(
    (goal) => run(() => api.rolloverGoal(goal.id, currentPeriodStartKey(goal.period))),
    [run]
  );

  const archiveGoal = useCallback((goalId) => run(() => api.archiveGoal(goalId)), [run]);

  const deleteGoal = useCallback((goalId) => run(() => api.deleteGoal(goalId)), [run]);

  const value = useMemo(
    () => ({
      goals,
      loading,
      busy,
      error,
      refresh,
      createGoal,
      updateGoal,
      increment,
      decrement,
      logAmount,
      rollover,
      archiveGoal,
      deleteGoal,
    }),
    [
      goals,
      loading,
      busy,
      error,
      refresh,
      createGoal,
      updateGoal,
      increment,
      decrement,
      logAmount,
      rollover,
      archiveGoal,
      deleteGoal,
    ]
  );

  return createElement(GoalsContext.Provider, { value }, children);
}

export function useGoals() {
  const context = useContext(GoalsContext);
  if (!context) {
    throw new Error('useGoals must be used inside a GoalsProvider');
  }
  return context;
}
