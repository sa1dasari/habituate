import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';

const ChallengesContext = createContext(null);

export function ChallengesProvider({ children }) {
  const [challenges, setChallenges] = useState([]);
  const [browseList, setBrowseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [mine, browse] = await Promise.all([api.listMyChallenges(), api.browseChallenges()]);
      setChallenges(mine || []);
      setBrowseList(browse || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load challenges');
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
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const createChallenge = useCallback((challenge) => run(() => api.createChallenge(challenge)), [run]);

  const joinChallenge = useCallback((challengeId) => run(() => api.joinChallenge(challengeId)), [run]);

  // Mirrors useHabits' runExclusive — a fast double-tap on the same
  // challenge's log/unlog toggle would otherwise race against stale state.
  const pendingChallengeIds = useRef(new Set());

  const runExclusive = useCallback(
    (challengeId, action) => {
      if (pendingChallengeIds.current.has(challengeId)) {
        return Promise.resolve(false);
      }
      pendingChallengeIds.current.add(challengeId);
      return run(action).finally(() => {
        pendingChallengeIds.current.delete(challengeId);
      });
    },
    [run]
  );

  // Boolean-only, one log per day — toggleCheckIn picks log vs. unlog based
  // on the challenge's own checkedInToday, same shape as a habit's toggle.
  const toggleCheckIn = useCallback(
    (challenge) =>
      runExclusive(challenge.id, () =>
        challenge.checkedInToday ? api.unlogChallengeCheckIn(challenge.id) : api.logChallengeCheckIn(challenge.id)
      ),
    [runExclusive]
  );

  const value = useMemo(
    () => ({ challenges, browseList, loading, busy, error, refresh, createChallenge, joinChallenge, toggleCheckIn }),
    [challenges, browseList, loading, busy, error, refresh, createChallenge, joinChallenge, toggleCheckIn]
  );

  return createElement(ChallengesContext.Provider, { value }, children);
}

export function useChallenges() {
  const context = useContext(ChallengesContext);
  if (!context) {
    throw new Error('useChallenges must be used inside a ChallengesProvider');
  }
  return context;
}
