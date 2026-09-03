import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';

const POLL_INTERVAL_MS = 60_000;

function timeAgo(dateString) {
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

// Surfaces the in-app notifications the backend already writes on every
// order status change, payment, and pickup-date assignment — previously
// there was no UI for these at all, so they went completely unseen.
export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function loadNotifications() {
    api
      .get('/notifications')
      .then(({ data }) => setNotifications(data.notifications))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) return undefined;
    loadNotifications();
    const interval = setInterval(loadNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

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

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-lg border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <p className="text-sm font-semibold text-ink-900 dark:text-white">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading && <p className="px-4 py-6 text-center text-xs text-slate-400">Loading...</p>}
              {!loading && notifications.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-slate-400">No notifications yet.</p>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read_at && markRead(n.id)}
                  className={`block w-full border-b border-slate-50 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/50 ${
                    n.read_at ? '' : 'bg-brand-50/50 dark:bg-brand-900/10'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                    <div className={n.read_at ? 'pl-3.5' : ''}>
                      <p className="text-sm font-semibold text-ink-900 dark:text-white">{n.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{n.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
