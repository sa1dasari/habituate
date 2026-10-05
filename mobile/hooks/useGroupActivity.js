import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';

const GroupActivityContext = createContext(null);

export function GroupActivityProvider({ children }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.listGroupActivity();
      setActivity(list || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load activity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Mirrors useChallenges' per-item lock — a fast double-tap on the same
  // heart would otherwise race cheer/uncheer against stale state.
  const pendingCheckInIds = useRef(new Set());

  const toggleCheer = useCallback(
    (item) => {
      if (pendingCheckInIds.current.has(item.checkInId)) {
        return Promise.resolve(false);
      }
      pendingCheckInIds.current.add(item.checkInId);
      const action = item.cheeredByMe ? api.uncheerCheckIn : api.cheerCheckIn;
      return action(item.checkInId)
        .then(() => {
          refresh();
          return true;
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Something went wrong');
          return false;
        })
        .finally(() => {
          pendingCheckInIds.current.delete(item.checkInId);
        });
    },
    [refresh]
  );

  const value = useMemo(
    () => ({ activity, loading, error, refresh, toggleCheer }),
    [activity, loading, error, refresh, toggleCheer]
  );

  return createElement(GroupActivityContext.Provider, { value }, children);
}

export function useGroupActivity() {
  const context = useContext(GroupActivityContext);
  if (!context) {
    throw new Error('useGroupActivity must be used inside a GroupActivityProvider');
  }
  return context;
}
