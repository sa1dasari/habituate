import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

  const adjustProgress = useCallback(
    (challengeId, delta) => run(() => api.adjustChallengeProgress(challengeId, delta)),
    [run]
  );

  const value = useMemo(
    () => ({ challenges, browseList, loading, busy, error, refresh, createChallenge, joinChallenge, adjustProgress }),
    [challenges, browseList, loading, busy, error, refresh, createChallenge, joinChallenge, adjustProgress]
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
