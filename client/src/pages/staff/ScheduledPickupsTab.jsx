import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Printer } from 'lucide-react';
import api from '../../api/axios';
import { useCurrency } from '../../context/CurrencyContext.jsx';
import { useBranch } from '../../context/BranchContext.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import PaymentStatusPill from '../../components/PaymentStatusPill.jsx';
import { todayISO } from './shared.jsx';

export function ScheduledPickupsTab() {
  const { formatPrice } = useCurrency();
  const { currentBranchId } = useBranch();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranchId]);

  function loadOrders() {
    setLoading(true);
    setError('');
    api
      .get('/orders', { params: { branch_id: currentBranchId || undefined } })
      .then(({ data }) => setOrders(data.orders))
      .catch(() => setError('Unable to load scheduled pickups.'))
      .finally(() => setLoading(false));
  }

  const scheduled = useMemo(
    () =>
      orders
        .filter((o) => o.pickup_date && !['completed', 'cancelled'].includes(o.status))
        .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date)),
    [orders]
  );

  const groups = useMemo(() => {
    const map = new Map();
    for (const order of scheduled) {
      const date = order.pickup_date.slice(0, 10);
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(order);
    }
    return Array.from(map.entries());
  }, [scheduled]);

  const today = todayISO();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  function dateLabel(dateStr) {
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink-900 dark:text-white">
          Scheduled Pickups ({scheduled.length})
        </h2>
        <button onClick={loadOrders} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Refresh
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading scheduled pickups...</p>}
      {!loading && groups.length === 0 && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No orders currently have a pickup date assigned.</p>
      )}

      <div className="mt-6 space-y-8">
        {groups.map(([date, dateOrders]) => {
          const isOverdue = date < today;
          return (
            <div key={date}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`text-sm font-bold uppercase tracking-widest ${isOverdue ? 'text-red-600' : 'text-brand-600'}`}>
                  {dateLabel(date)}
                </h3>
                <span className="text-xs font-semibold text-slate-400">{date}</span>
                <span className="text-xs font-semibold text-slate-400">
                  · {dateOrders.length} order{dateOrders.length === 1 ? '' : 's'}
                </span>
                {isOverdue && (
                  <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    <AlertTriangle size={11} /> Overdue
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-3">
                {dateOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div>
                      <p className="font-semibold text-ink-900 dark:text-white">
                        #{order.id} · {order.items_summary || `${order.item_count} item(s)`} — {order.customer_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {order.customer_phone} · Drop-off {order.drop_off_date?.slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusPill status={order.status} />
                      <PaymentStatusPill status={order.payment_status} />
                      <span className="font-semibold text-brand-600">{formatPrice(order.total_price)}</span>
                      <Link
                        to={`/orders/${order.id}/receipt`}
                        className="text-slate-400 transition hover:text-brand-600"
                        title="Print Receipt"
                      >
                        <Printer size={16} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
