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

  // Rethrows on failure (doesn't swallow to a boolean) so callers can show
  // the backend's actual reason — e.g. "User is already invited or a member
  // of this group" — instead of a generic message. Matches useHabits/
  // useGoals' existing pattern; this hook used to differ and every caller's
  // error handling paid for it with a useless fallback message.
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

  // Mirrors useHabits' runExclusive: invite/accept on the same group id firing
  // twice (double-tap) would otherwise race against its own stale state. A
  // suppressed double-tap isn't an error, so it resolves quietly rather than
  // throwing or returning anything meaningful.
  const pendingGroupIds = useRef(new Set());

  const runExclusive = useCallback(
    (groupId, action) => {
      if (pendingGroupIds.current.has(groupId)) {
        return Promise.resolve();
      }
      pendingGroupIds.current.add(groupId);
      return run(action).finally(() => {
        pendingGroupIds.current.delete(groupId);
      });
    },
    [run]
  );

  const createGroup = useCallback((group) => run(() => api.createGroup(group)), [run]);

  const updateGroup = useCallback((groupId, group) => run(() => api.updateGroup(groupId, group)), [run]);

  const deleteGroup = useCallback((groupId) => run(() => api.deleteGroup(groupId)), [run]);

  const inviteToGroup = useCallback(
    (groupId, friendUserId) => runExclusive(groupId, () => api.inviteToGroup(groupId, friendUserId)),
    [runExclusive]
  );

  const acceptInvite = useCallback(
    (groupId, habitId) => runExclusive(groupId, () => api.acceptGroupInvite(groupId, habitId)),
    [runExclusive]
  );

  // Not run() — a nudge has no local state to refresh, so busy/error from a
  // concurrent create/invite elsewhere shouldn't be tied to this action.
  const nudge = useCallback((groupId, targetUserId) => api.nudgeGroupMember(groupId, targetUserId), []);

  const value = useMemo(
    () => ({
      groups,
      pendingInvites,
      loading,
      busy,
      error,
      refresh,
      createGroup,
      updateGroup,
      deleteGroup,
      inviteToGroup,
      acceptInvite,
      nudge,
    }),
    [
      groups,
      pendingInvites,
      loading,
      busy,
      error,
      refresh,
      createGroup,
      updateGroup,
      deleteGroup,
      inviteToGroup,
      acceptInvite,
      nudge,
    ]
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
