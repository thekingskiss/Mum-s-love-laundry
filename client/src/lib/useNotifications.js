import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';

const POLL_INTERVAL_MS = 60_000;

export function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

// The signed-in user's in-app notifications, kept fresh by polling. Shared by
// the navbar bell and the customer dashboard's Notifications page.
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function loadNotifications() {
    api
      .get('/notifications')
      .then(({ data }) => {
        setNotifications(data.notifications);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) return undefined;
    loadNotifications();
    const interval = setInterval(loadNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user]);

  async function markRead(id) {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      loadNotifications();
    }
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read_at);
    setNotifications((list) => list.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    try {
      await Promise.all(unread.map((n) => api.patch(`/notifications/${n.id}/read`)));
    } catch {
      loadNotifications();
    }
  }

  return { notifications, unreadCount, loading, failed, markRead, markAllRead };
}
