import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const InsightsContext = createContext(null);

export function InsightsProvider({ children }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.listInsights();
      setInsights(list || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load insights');
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

  // The nightly job covers everyone automatically; this lets a user pull a
  // fresh read right now instead of waiting, and is also what actually
  // produces the first insight for a brand-new pairing.
  const recompute = useCallback(() => run(() => api.recomputeInsights()), [run]);

  const dismiss = useCallback((insightId) => run(() => api.dismissInsight(insightId)), [run]);

  const value = useMemo(
    () => ({ insights, loading, busy, error, refresh, recompute, dismiss }),
    [insights, loading, busy, error, refresh, recompute, dismiss]
  );

  return createElement(InsightsContext.Provider, { value }, children);
}

export function useInsights() {
  const context = useContext(InsightsContext);
  if (!context) {
    throw new Error('useInsights must be used inside an InsightsProvider');
  }
  return context;
}
