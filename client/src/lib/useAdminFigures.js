import { useEffect, useState } from 'react';
import api from '../api/axios';

const REFRESH_MS = 60_000;

/**
 * The attention counts behind the admin navigation badges (unread messages,
 * overdue pickups, low stock), from GET /admin/overview. Pass `enabled: false`
 * for roles that can't call it. `refreshKey` re-fetches right after acting on
 * something, so a badge clears without waiting for the next poll.
 */
export function useAdminFigures({ branchId, refreshKey, enabled = true }) {
  const [figures, setFigures] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    function load() {
      api
        .get('/admin/overview', { params: { branch_id: branchId || undefined } })
        .then(({ data }) => {
          if (!cancelled) setFigures(data);
        })
        .catch(() => {});
    }

    load();
    const interval = setInterval(load, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [branchId, refreshKey, enabled]);

  return figures;
}
