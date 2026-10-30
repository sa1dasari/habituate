import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/client';

const NotificationsContext = createContext(null);

// No websocket/SSE in this app — a light poll while the provider is mounted
// (i.e. the whole time the user is signed in) is enough to keep the unread
// badge roughly live without building real-time infra for a first pass.
const POLL_INTERVAL_MS = 60000;

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [list, unread] = await Promise.all([
        api.listNotifications(),
        api.getUnreadNotificationCount(),
      ]);
      if (!mounted.current) return;
      setNotifications(list || []);
      setUnreadCount(unread?.count || 0);
    } catch {
      // Best-effort — a failed refresh just leaves the last-known state on screen.
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (id) => {
      setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((current) => Math.max(0, current - 1));
      try {
        await api.markNotificationRead(id);
      } catch {
        // Best-effort — a brief UI/server mismatch resolves itself on the next refresh.
      }
    },
    []
  );

  const markUnread = useCallback(
    async (id) => {
      setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: false } : n)));
      setUnreadCount((current) => current + 1);
      try {
        await api.markNotificationUnread(id);
      } catch {
        // Best-effort, same as markRead.
      }
    },
    []
  );

  const deleteNotification = useCallback(
    async (id) => {
      let wasUnread = false;
      setNotifications((current) => {
        const target = current.find((n) => n.id === id);
        wasUnread = target ? !target.read : false;
        return current.filter((n) => n.id !== id);
      });
      if (wasUnread) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }
      try {
        await api.deleteNotification(id);
      } catch {
        // Best-effort, same as markRead — a brief UI/server mismatch resolves on the next refresh.
      }
    },
    []
  );

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.markAllNotificationsRead();
    } catch {
      // Best-effort, same as markRead.
    }
  }, []);

  const value = { notifications, unreadCount, loading, refresh, markRead, markUnread, markAllRead, deleteNotification };

  return createElement(NotificationsContext.Provider, { value }, children);
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used inside a NotificationsProvider');
  }
  return context;
}
