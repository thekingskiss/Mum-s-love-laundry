import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Wallet,
} from 'lucide-react';
import api from '../../api/axios';
import { useCurrency } from '../../context/CurrencyContext.jsx';
import { useBranch } from '../../context/BranchContext.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import { STATUS_LABELS } from '../../lib/orderLifecycle';
import { summarizeOrders } from '../../lib/staffOverview';
import { todayISO } from './shared.jsx';

const ORDERS_TAB_PATH = '/staff?tab=orders';

// GET /orders returns at most this many orders, newest first.
const ORDER_LIST_CAP = 200;

function OverviewCard({ icon: Icon, label, value, detail, tone = 'default' }) {
  const urgent = tone === 'urgent';
  return (
    <Link
      to={ORDERS_TAB_PATH}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft transition hover:border-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <Icon size={18} className={urgent ? 'text-red-500' : 'text-slate-400'} />
      </div>
      <p className={`mt-3 font-display text-3xl font-semibold ${urgent ? 'text-red-600 dark:text-red-400' : 'text-ink-900 dark:text-white'}`}>
        {value}
      </p>
      <p className="mt-1 min-h-4 text-xs text-slate-400">{detail}</p>
    </Link>
  );
}

function OverviewOrderRow({ order, children }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
          #{order.id} — {order.customer_name}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{children}</p>
      </div>
      <StatusPill status={order.status} />
    </li>
  );
}

export function DashboardTab() {
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
    return api
      .get('/orders', { params: { branch_id: currentBranchId || undefined } })
      .then(({ data }) => setOrders(data.orders))
      .catch(() => setError('Unable to load the overview.'))
      .finally(() => setLoading(false));
  }

  const today = todayISO();
  const summary = useMemo(() => summarizeOrders(orders, today), [orders, today]);
  const busiestStage = Math.max(1, ...summary.stages.map((stage) => stage.count));
  const panelClass = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Overview</h2>
        <button onClick={loadOrders} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Refresh
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Loading overview">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <OverviewCard icon={ClipboardList} label="Active orders" value={summary.activeCount} detail="Not yet collected" />
            <OverviewCard icon={CheckCircle2} label="Ready for pickup" value={summary.readyCount} detail="Waiting for the customer" />
            <OverviewCard
              icon={AlertTriangle}
              label="Overdue pickups"
              value={summary.overdueCount}
              detail={`${summary.dueTodayCount} more due today`}
              tone={summary.overdueCount > 0 ? 'urgent' : 'default'}
            />
            <OverviewCard
              icon={Wallet}
              label="Awaiting payment"
              value={summary.owingCount}
              detail={`${formatPrice(summary.owingTotal)} outstanding`}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className={panelClass}>
              <h3 className="font-semibold text-ink-900 dark:text-white">Orders by stage</h3>
              <ul className="mt-4 space-y-3">
                {summary.stages.map((stage) => (
                  <li key={stage.status}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300">{STATUS_LABELS[stage.status]}</span>
                      <span className="font-semibold text-ink-900 dark:text-white">{stage.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-1.5 rounded-full bg-brand-500"
                        style={{ width: `${(stage.count / busiestStage) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className={panelClass}>
              <h3 className="font-semibold text-ink-900 dark:text-white">Pickups to follow up</h3>
              {summary.pickups.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Nothing overdue or due today.</p>
              ) : (
                <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-700">
                  {summary.pickups.map((order) => (
                    <OverviewOrderRow key={order.id} order={order}>
                      Pickup {order.pickup_date.slice(0, 10)} · {order.customer_phone}
                    </OverviewOrderRow>
                  ))}
                </ul>
              )}
              {summary.morePickups > 0 && (
                <p className="mt-2 text-xs text-slate-400">and {summary.morePickups} more in the order queue</p>
              )}
            </section>
          </div>

          <section className={`mt-6 ${panelClass}`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-ink-900 dark:text-white">Latest orders</h3>
              <Link to={ORDERS_TAB_PATH} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                View all orders
              </Link>
            </div>
            {summary.recent.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No orders yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-700">
                {summary.recent.map((order) => (
                  <OverviewOrderRow key={order.id} order={order}>
                    {order.branch_name} · Drop-off {order.drop_off_date?.slice(0, 10)} · {formatPrice(order.total_price)}
                  </OverviewOrderRow>
                ))}
              </ul>
            )}
          </section>

          {orders.length >= ORDER_LIST_CAP && (
            <p className="mt-4 text-xs text-slate-400">Figures cover the latest {ORDER_LIST_CAP} orders.</p>
          )}
        </>
      )}
    </div>
  );
}
