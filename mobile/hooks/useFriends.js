import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const FriendsContext = createContext(null);

export function FriendsProvider({ children }) {
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [accepted, pending] = await Promise.all([api.listFriends(), api.listPendingFriendRequests()]);
      setFriends(accepted || []);
      setPendingRequests(pending || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load friends');
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

  const sendRequest = useCallback((email) => run(() => api.sendFriendRequest(email)), [run]);

  const acceptRequest = useCallback((friendshipId) => run(() => api.acceptFriendRequest(friendshipId)), [run]);

  const declineRequest = useCallback((friendshipId) => run(() => api.declineFriendRequest(friendshipId)), [run]);

  const value = useMemo(
    () => ({ friends, pendingRequests, loading, busy, error, refresh, sendRequest, acceptRequest, declineRequest }),
    [friends, pendingRequests, loading, busy, error, refresh, sendRequest, acceptRequest, declineRequest]
  );

  return createElement(FriendsContext.Provider, { value }, children);
}

export function useFriends() {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used inside a FriendsProvider');
  }
  return context;
}
