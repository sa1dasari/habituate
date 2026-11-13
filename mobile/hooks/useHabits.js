import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { cadenceProgress } from '../utils/cadence';
import { toDateKey } from '../utils/date';
import { syncHabitSnapshot } from '../utils/widgetSync';

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

/** A short-lived stand-in for a check-in that hasn't round-tripped to the
 * server yet — see `patchHabitCheckIns` below. Its id is never a real
 * server id; `refresh()` (which every mutator still runs right after)
 * replaces it with the authoritative row within one refresh cycle. */
function optimisticCheckIn(dayKey, value) {
  return { id: `optimistic-${dayKey}-${Date.now()}`, occurredAt: instantForDayKey(dayKey), value, source: 'manual' };
}

/** Applies a partial field patch to one habit immediately — the same
 * "flip the UI before the network call lands" idea as patchHabitCheckIns,
 * for a scalar field rather than the check-ins array. */
function patchHabitFields(setHabits, habitId, fields) {
  setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, ...fields } : h)));
}

/** Applies `updater` to one habit's `checkIns` immediately, recomputing
 * `checkedInToday` from the result — the two fields `getCanBuild` and
 * `HoldPillButton`'s `built` state actually key off. Every check-in mutator
 * below calls this right before its network request, so the Hold pill
 * flips to "Built" (and a lot tile's day cell lights up) the instant a hold
 * completes, instead of waiting on `refresh()`'s full
 * listHabits+every-habit's-listCheckIns round trip to the API. `refresh()`
 * still runs afterward (success or failure — see `run`'s comment) and
 * overwrites this with the server's real state, so a transient wrong guess
 * here (e.g. a 409/404 race) self-heals within one cycle. */
function patchHabitCheckIns(setHabits, habitId, updater) {
  setHabits((prev) =>
    prev.map((h) => {
      if (h.id !== habitId) return h;
      const checkIns = updater(h.checkIns);
      const today = toDateKey(new Date());
      const checkedInToday = checkIns.some((ci) => toDateKey(ci.occurredAt) === today);
      return { ...h, checkIns, checkedInToday };
    }),
  );
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
  // How many Shield Days the user has banked right now — fetched alongside
  // habits so TodayScreen's shield icon and its Shield Days info modal
  // can read it from one place instead of each fetching it separately.
  const [shieldsAvailable, setShieldsAvailable] = useState(0);

  // Concurrent same-habit mutations (addCheckIn deliberately allows these —
  // see its comment) each trigger their own refresh(), and those network
  // round trips can resolve out of order: an earlier refresh started before
  // a later tap's write even landed, so if it applied its (now-stale)
  // result after a newer refresh already did, it would stomp the newer,
  // more current state back to an older one. Stamping each call and only
  // applying the result if it's still the most recently started one fixes
  // that without needing to serialize refreshes.
  const refreshSeq = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current;
    try {
      setLoading(true);
      const [active, archived, shields] = await Promise.all([
        api.listHabits(),
        api.listArchivedHabits(),
        api.getShields().catch(() => ({ available: 0 })),
      ]);
      const enrichedHabits = await Promise.all((active || []).map(hydrate));
      if (seq !== refreshSeq.current) return; // a newer refresh already landed — don't overwrite it with this stale one
      setHabits(enrichedHabits);
      setArchivedHabits(archived || []);
      setShieldsAvailable(shields?.available || 0);
      setError('');
      // Home-screen widgets (SKILLS.md Phase 7) read a cached snapshot, not a
      // live API call — keep it current every time the real list refreshes.
      syncHabitSnapshot(enrichedHabits).catch(() => {});
    } catch (err) {
      if (seq !== refreshSeq.current) return;
      setError(err instanceof Error ? err.message : 'Could not load habits');
    } finally {
      if (seq === refreshSeq.current) setLoading(false);
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
      } catch (err) {
        // Reconciles with the server in the background rather than
        // awaiting it here — necessary now that some actions (the check-in
        // mutators below) apply an optimistic local patch before the
        // network call, so a thrown error must not leave that patch stuck
        // un-reconciled. But awaiting it would delay this rethrow until
        // after a full refresh round trip, which means the UI would
        // silently snap back to the pre-optimistic state first and only
        // show the error toast a beat later — confusing on its own.
        // Firing it without awaiting keeps the error (and the caller's
        // toast) immediate while refresh() still catches up right after.
        refresh();
        throw err;
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

        patchHabitCheckIns(setHabits, habitId, (checkIns) =>
          existing
            ? checkIns.filter((ci) => ci.id !== existing.id)
            : [...checkIns, optimisticCheckIn(dayKey, 1)],
        );

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
        patchHabitCheckIns(setHabits, habitId, (checkIns) => [...checkIns, optimisticCheckIn(dayKey, value)]);
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
          patchHabitCheckIns(setHabits, habitId, (checkIns) => checkIns.filter((ci) => ci.id !== todays[0].id));
          // A fake optimistic row (see optimisticCheckIn above) never reached
          // the server, so there's nothing to delete there — the local
          // filter above already removed it, and refresh() will replace it
          // with whatever the server actually holds within one cycle.
          if (String(todays[0].id).startsWith('optimistic-')) return;
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

  // Deletes one specific check-in by id — the lot sheet's per-entry Remove
  // (SKYLINE.md section 4a). Unlike removeLastCheckIn (today's most recent
  // one only), this targets an exact row from a period's check-ins list,
  // since a COUNT habit's period can hold several and a BOOLEAN period can
  // span any of several past days, not just today.
  const removeCheckIn = useCallback(
    (habitId, checkInId) =>
      runExclusive(habitId, async () => {
        patchHabitCheckIns(setHabits, habitId, (checkIns) => checkIns.filter((ci) => ci.id !== checkInId));
        // Same optimistic-row guard as removeLastCheckIn: a row the user
        // tapped Remove on before its own add had round-tripped was never a
        // real server row, so deleting it would 400 (the backend expects a
        // numeric id), not the 404 the catch below expects.
        if (String(checkInId).startsWith('optimistic-')) return;
        try {
          await api.deleteCheckIn(checkInId);
        } catch (err) {
          // Already gone — same desired-state-already-holds case as above.
          if (err?.status !== 404) throw err;
        }
      }),
    [runExclusive]
  );

  // Toggles today's manual shield for a habit — activate requires a 7+ day
  // streak and a banked shield (enforced server-side); deactivate just
  // refunds whichever shield (manual or automatic) is currently protecting
  // today. runExclusive's per-habit lock avoids a fast double-tap racing
  // itself the same way toggleCheckIn already guards against.
  const toggleShield = useCallback(
    (habitId) =>
      runExclusive(habitId, async () => {
        const habit = habits.find((item) => item.id === habitId);
        if (!habit) return;
        const wasShielded = habit.shieldedToday;
        // Optimistic flip, same reasoning as the check-in mutators — the
        // server can still reject this (streak too short, no shield
        // banked, already shielded), in which case refresh() flips it back
        // within one cycle, same as a check-in race self-healing.
        patchHabitFields(setHabits, habitId, { shieldedToday: !wasShielded });
        if (wasShielded) {
          await api.deactivateShield(habitId);
        } else {
          await api.activateShield(habitId);
        }
      }),
    [habits, runExclusive]
  );

  // Server-validated (48h window, once/habit/month) — HabitCard's own guard is
  // only a coarse pre-filter, so this can still reject with a specific message.
  const repairStreak = useCallback(
    (habitId) => runExclusive(habitId, () => api.repairStreak(habitId)),
    [runExclusive]
  );

  const deleteHabit = useCallback((habitId) => run(() => api.deleteHabit(habitId)), [run]);

  // Closes the habit's current tower segment and opens a new one (SKYLINE.md
  // section 6, daily-cadence only) — server-validated (ownership, cadence,
  // age threshold), so this can still reject with a specific message even
  // if a caller's own eligibility check was stale.
  const topOutHabit = useCallback(
    (habitId) => runExclusive(habitId, () => api.topOutHabit(habitId)),
    [runExclusive]
  );

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
      removeCheckIn,
      toggleShield,
      repairStreak,
      shieldsAvailable,
      deleteHabit,
      topOutHabit,
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
      removeCheckIn,
      toggleShield,
      repairStreak,
      shieldsAvailable,
      deleteHabit,
      topOutHabit,
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
