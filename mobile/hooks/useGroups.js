import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';

const GroupsContext = createContext(null);

export function GroupsProvider({ children }) {
  const [groups, setGroups] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [myGroups, invites] = await Promise.all([api.listGroups(), api.listPendingGroupInvites()]);
      setGroups(myGroups || []);
      setPendingInvites(invites || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load groups');
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

  // Mirrors useHabits' runExclusive: invite/accept on the same group id firing
  // twice (double-tap) would otherwise race against its own stale state.
  const pendingGroupIds = useRef(new Set());

  const runExclusive = useCallback(
    (groupId, action) => {
      if (pendingGroupIds.current.has(groupId)) {
        return Promise.resolve(false);
      }
      pendingGroupIds.current.add(groupId);
      return run(action).finally(() => {
        pendingGroupIds.current.delete(groupId);
      });
    },
    [run]
  );

  const createGroup = useCallback((group) => run(() => api.createGroup(group)), [run]);

  const inviteToGroup = useCallback(
    (groupId, friendUserId) => runExclusive(groupId, () => api.inviteToGroup(groupId, friendUserId)),
    [runExclusive]
  );

  const acceptInvite = useCallback(
    (groupId, habitId) => runExclusive(groupId, () => api.acceptGroupInvite(groupId, habitId)),
    [runExclusive]
  );

  const value = useMemo(
    () => ({
      groups,
      pendingInvites,
      loading,
      busy,
      error,
      refresh,
      createGroup,
      inviteToGroup,
      acceptInvite,
    }),
    [groups, pendingInvites, loading, busy, error, refresh, createGroup, inviteToGroup, acceptInvite]
  );

  return createElement(GroupsContext.Provider, { value }, children);
}

export function useGroups() {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used inside a GroupsProvider');
  }
  return context;
}
