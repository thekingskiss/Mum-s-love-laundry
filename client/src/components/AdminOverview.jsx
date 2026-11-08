import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Mail,
  Minus,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api from '../api/axios';
import { useBranch } from '../context/BranchContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { countChange, labelledDays, niceCeiling, percentChange, weekTotals } from '../lib/adminOverview';
import { MILESTONES, STATUS_LABELS, STATUS_STYLES } from '../lib/orderLifecycle';

const adminTab = (tab) => `/admin?tab=${tab}`;
const PANEL = 'rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800';
const ORDER_LINK = 'font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200';
const PIPELINE_STAGES = MILESTONES.filter((status) => status !== 'completed');

const ATTENTION_TONES = {
  danger: 'border-danger-line bg-danger-soft text-danger',
  warning: 'border-warning-line bg-warning-soft text-warning',
  info: 'border-info-line bg-info-soft text-info',
};

const CHANGE_STYLES = {
  up: { icon: ArrowUpRight, className: 'text-success', word: 'Up' },
  down: { icon: ArrowDownRight, className: 'text-danger', word: 'Down' },
  flat: { icon: Minus, className: 'text-slate-500 dark:text-slate-400', word: '' },
};

function shortDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function AttentionCard({ to, icon: Icon, tone, title, detail }) {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${ATTENTION_TONES[tone]}`}
    >
      <Icon size={20} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs opacity-90">{detail}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 transition group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function AttentionSection({ overview }) {
  const { overdue_pickups: overdue, late_fees_accruing: lateFees, low_stock_count: lowStock, unread_messages: unread } = overview;
  const items = [
    overdue > 0 && {
      to: adminTab('pickups'),
      icon: AlertTriangle,
      tone: 'danger',
      title: `${plural(overdue, 'overdue pickup')}`,
      detail: lateFees > 0 ? `${lateFees} accruing storage fees` : 'Past their pickup date',
    },
    lowStock > 0 && {
      to: adminTab('inventory'),
      icon: Boxes,
      tone: 'warning',
      title: `${plural(lowStock, 'item')} low on stock`,
      detail: 'At or below the reorder level',
    },
    unread > 0 && {
      to: adminTab('messages'),
      icon: Mail,
      tone: 'info',
      title: `${plural(unread, 'unread message')}`,
      detail: 'From the contact page',
    },
  ].filter(Boolean);

  if (items.length === 0) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-xl border border-success-line bg-success-soft px-4 py-3 text-sm font-semibold text-success">
        <CheckCircle2 size={18} aria-hidden="true" />
        Nothing needs attention right now
      </p>
    );
  }

  return (
    <section aria-label="Needs attention" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <AttentionCard key={item.to} {...item} />
      ))}
    </section>
  );
}

function ChangeLine({ change, comparedTo }) {
  const { icon: Icon, className, word } = CHANGE_STYLES[change.direction];
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${className}`}>
        <Icon size={14} aria-hidden="true" />
        {word} {change.label}
      </span>
      <span>{comparedTo}</span>
    </span>
  );
}

function StatTile({ to, icon: Icon, label, value, children }) {
  return (
    <Link
      to={to}
      className={`${PANEL} block p-5 transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 dark:hover:border-slate-500`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <Icon size={16} className="text-slate-400" aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 dark:text-white">{value}</p>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{children}</div>
    </Link>
  );
}

function PanelHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="font-semibold text-ink-900 dark:text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyPanelText({ children }) {
  return <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}

function tooltipPosition(index, count) {
  if (index <= 3) return 'left-0';
  if (index >= count - 4) return 'right-0';
  return 'left-1/2 -translate-x-1/2';
}

function RevenueColumns({ trend, today, formatPrice }) {
  const top = niceCeiling(Math.max(...trend.map((day) => day.revenue)));
  const ticks = [top, top / 2, 0];
  const labels = labelledDays(trend, today);

  return (
    <div className="mt-5">
      <div className="flex">
        <div className="relative h-44 w-20 shrink-0" aria-hidden="true">
          {ticks.map((tick, index) => (
            <span
              key={tick}
              style={{ top: `${index * 50}%` }}
              className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[11px] tabular-nums text-slate-500 dark:text-slate-400"
            >
              {formatPrice(tick)}
            </span>
          ))}
        </div>
        <div className="relative h-44 min-w-0 flex-1">
          {ticks.map((tick, index) => (
            <div key={tick} style={{ top: `${index * 50}%` }} className="absolute inset-x-0 h-px bg-slate-200 dark:bg-slate-700" />
          ))}
          <div className="relative flex h-full gap-0.5">
            {trend.map((day, index) => {
              const isFuture = day.date > today;
              return (
                <div
                  key={day.date}
                  tabIndex={0}
                  aria-label={`${shortDate(day.date)}: ${formatPrice(day.revenue)}, ${plural(day.order_count, 'order')}`}
                  className={`group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-sm hover:bg-slate-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 dark:hover:bg-slate-700/40 ${index === 7 ? 'ml-1.5' : ''}`}
                >
                  {day.revenue > 0 && (
                    <div
                      style={{ height: `${Math.max((day.revenue / top) * 100, 1.5)}%` }}
                      className={`w-full max-w-[24px] rounded-t ${index >= 7 ? 'bg-violet-600 dark:bg-violet-500' : 'bg-slate-400 dark:bg-slate-500'}`}
                    />
                  )}
                  <div className={`pointer-events-none absolute top-0 z-10 hidden whitespace-nowrap rounded-lg bg-ink-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block group-focus-visible:block dark:bg-slate-950 ${tooltipPosition(index, trend.length)}`}>
                    <p className="text-sm font-semibold">{formatPrice(day.revenue)}</p>
                    <p className="text-slate-300">
                      {shortDate(day.date)} · {isFuture ? 'upcoming' : plural(day.order_count, 'order')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex" aria-hidden="true">
        <div className="w-20 shrink-0" />
        <div className="flex min-w-0 flex-1 gap-0.5 pt-2">
          {trend.map((day, index) => (
            <div key={day.date} className={`relative h-4 min-w-0 flex-1 ${index === 7 ? 'ml-1.5' : ''}`}>
              {labels.includes(index) && (
                <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] ${day.date === today ? 'font-semibold text-ink-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                  {day.date === today ? 'Today' : shortDate(day.date)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RevenueTable({ trend, formatPrice }) {
  return (
    <div className="mt-4 max-h-56 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            <th className="py-2 font-medium">Day</th>
            <th className="py-2 text-right font-medium">Orders</th>
            <th className="py-2 text-right font-medium">Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {trend.map((day) => (
            <tr key={day.date} className="text-slate-600 dark:text-slate-300">
              <td className="py-1.5">{shortDate(day.date)}</td>
              <td className="py-1.5 text-right tabular-nums">{day.order_count}</td>
              <td className="py-1.5 text-right tabular-nums">{formatPrice(day.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenuePanel({ activity, formatPrice }) {
  const [showTable, setShowTable] = useState(false);
  const trend = activity.trend ?? [];
  const totals = weekTotals(trend);
  const hasRevenue = totals.lastWeek + totals.thisWeek > 0;

  return (
    <section className={`${PANEL} p-5 lg:col-span-2`}>
      <PanelHeader
        title="Revenue"
        subtitle="Order value by day, this week against last"
        action={hasRevenue && (
          <button
            type="button"
            onClick={() => setShowTable((value) => !value)}
            className="text-xs font-semibold text-slate-500 hover:text-ink-900 dark:text-slate-400 dark:hover:text-white"
          >
            {showTable ? 'View chart' : 'View table'}
          </button>
        )}
      />
      {!hasRevenue && <EmptyPanelText>No orders in the last two weeks yet.</EmptyPanelText>}
      {hasRevenue && (
        <>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-violet-600 dark:bg-violet-500" aria-hidden="true" />
              This week <strong className="font-semibold text-ink-900 dark:text-white">{formatPrice(totals.thisWeek)}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400 dark:bg-slate-500" aria-hidden="true" />
              Last week <strong className="font-semibold text-ink-900 dark:text-white">{formatPrice(totals.lastWeek)}</strong>
            </span>
          </div>
          {showTable
            ? <RevenueTable trend={trend} formatPrice={formatPrice} />
            : <RevenueColumns trend={trend} today={activity.today} formatPrice={formatPrice} />}
        </>
      )}
    </section>
  );
}

function PipelinePanel({ pipeline }) {
  const counts = Object.fromEntries((pipeline ?? []).map((row) => [row.status, row.count]));
  const stages = PIPELINE_STAGES.map((status) => ({ status, count: counts[status] ?? 0 }));
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);
  const largest = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <section className={`${PANEL} p-5`}>
      <PanelHeader title="Order pipeline" subtitle={`${plural(total, 'active order')} by stage`} />
      {total === 0 ? (
        <EmptyPanelText>No orders in progress.</EmptyPanelText>
      ) : (
        <ul className="mt-5 space-y-4">
          {stages.map((stage) => (
            <li key={stage.status}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-slate-600 dark:text-slate-300">{STATUS_LABELS[stage.status]}</span>
                <span className="font-semibold tabular-nums text-ink-900 dark:text-white">{stage.count}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                {stage.count > 0 && (
                  <div
                    style={{ width: `${(stage.count / largest) * 100}%` }}
                    className="h-full rounded-full bg-violet-600 dark:bg-violet-500"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ViewAllLink({ to }) {
  return (
    <Link to={to} className={`text-xs ${ORDER_LINK}`}>
      View all
    </Link>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || ''}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function RecentOrdersPanel({ orders, formatPrice }) {
  return (
    <section className={`${PANEL} p-5 lg:col-span-2`}>
      <PanelHeader title="Recent orders" action={<ViewAllLink to={adminTab('orders')} />} />
      {orders.length === 0 ? (
        <EmptyPanelText>No orders yet.</EmptyPanelText>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-2 font-medium sm:pr-4">Order</th>
                <th className="py-2 pr-2 font-medium sm:pr-4">Customer</th>
                <th className="hidden py-2 pr-4 font-medium sm:table-cell">Status</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="py-2.5 pr-2 sm:pr-4">
                    <Link to={`/orders/${order.id}/receipt`} className={ORDER_LINK}>
                      #{order.id}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-300 sm:pr-4">
                    {order.customer_name}
                    {/* On a phone the status sits here, so the total stays in view. */}
                    <span className="mt-1 block sm:hidden"><StatusPill status={order.status} /></span>
                  </td>
                  <td className="hidden py-2.5 pr-4 sm:table-cell">
                    <StatusPill status={order.status} />
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {formatPrice(order.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PickupsPanel({ pickups }) {
  return (
    <section className={`${PANEL} p-5`}>
      <PanelHeader title="Pickups to follow up" subtitle="Oldest first" action={<ViewAllLink to={adminTab('pickups')} />} />
      {pickups.length === 0 ? (
        <EmptyPanelText>Nothing overdue or due today.</EmptyPanelText>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
          {pickups.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <Link to={`/orders/${order.id}/receipt`} className={ORDER_LINK}>
                  #{order.id}
                </Link>
                <span className="ml-2 text-slate-600 dark:text-slate-300">{order.customer_name}</span>
              </span>
              <span className={`shrink-0 text-xs font-semibold ${order.days_late > 0 ? 'text-danger' : 'text-slate-500 dark:text-slate-400'}`}>
                {order.days_late > 0 ? `${plural(order.days_late, 'day')} late` : 'Due today'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BranchComparison({ branches, formatPrice }) {
  return (
    <section className={`${PANEL} mt-4 overflow-hidden`}>
      <h3 className="px-5 pt-5 font-semibold text-ink-900 dark:text-white">Branch comparison</h3>
      <div className="relative mt-3 overflow-x-auto">
        <table className="table-cards w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Branch</th>
              <th className="px-5 py-3 text-right font-medium">Orders today</th>
              <th className="px-5 py-3 text-right font-medium">Ready</th>
              <th className="px-5 py-3 text-right font-medium">Overdue</th>
              <th className="px-5 py-3 text-right font-medium">Revenue this week</th>
              <th className="px-5 py-3 text-right font-medium">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-slate-700">
            {branches.map((branch) => (
              <tr key={branch.id}>
                <td className="px-5 py-3 font-medium text-ink-900 dark:text-white">{branch.name}</td>
                <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{branch.orders_today}</td>
                <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{branch.ready_for_pickup}</td>
                <td className={`px-5 py-3 text-right ${branch.overdue_pickups > 0 ? 'font-semibold text-danger' : 'text-slate-600 dark:text-slate-300'}`}>
                  {branch.overdue_pickups}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600 dark:text-slate-300">{formatPrice(branch.revenue_this_week)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600 dark:text-slate-300">{formatPrice(branch.outstanding_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminOverview() {
  const { formatPrice } = useCurrency();
  const { currentBranchId } = useBranch();
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranchId]);

  function loadOverview() {
    const params = { branch_id: currentBranchId || undefined };
    setLoading(true);
    setError('');
    return Promise.all([
      api.get('/admin/overview', { params }),
      // The headline figures still show if only the charts fail to load.
      api.get('/admin/overview/activity', { params }).catch(() => null),
    ])
      .then(([figures, details]) => {
        setOverview(figures.data);
        setActivity(details ? details.data : null);
        setUpdatedAt(new Date());
      })
      .catch(() => setError('Unable to load the overview.'))
      .finally(() => setLoading(false));
  }

  const branches = overview?.by_branch ?? [];
  const revenueChange = activity && percentChange(overview?.revenue_this_week, activity.revenue_last_week_to_date);
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink-900 dark:text-white">Business overview</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {todayLabel}
            {updatedAt && ` · Updated ${updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
          </p>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {loading && !overview && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading overview">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={`${PANEL} h-32 animate-pulse`} />
          ))}
        </div>
      )}

      {overview && (
        <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <AttentionSection overview={overview} />

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile to={adminTab('analytics')} icon={TrendingUp} label="Revenue this week" value={formatPrice(overview.revenue_this_week)}>
              {revenueChange ? <ChangeLine change={revenueChange} comparedTo="vs this point last week" /> : 'Order value since Monday'}
            </StatTile>
            <StatTile to={adminTab('orders')} icon={ClipboardList} label="Orders today" value={overview.orders_today}>
              {activity
                ? <ChangeLine change={countChange(overview.orders_today, activity.orders_yesterday_to_date)} comparedTo="vs this time yesterday" />
                : 'Booked or dropped off today'}
            </StatTile>
            <StatTile to={adminTab('orders')} icon={CheckCircle2} label="Ready for pickup" value={overview.ready_for_pickup}>
              Waiting for the customer
            </StatTile>
            <StatTile to={adminTab('payments')} icon={Wallet} label="Outstanding balance" value={formatPrice(overview.outstanding_balance)}>
              Still owed by customers
            </StatTile>
          </div>

          {activity ? (
            <>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <RevenuePanel activity={activity} formatPrice={formatPrice} />
                <PipelinePanel pipeline={activity.pipeline} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <RecentOrdersPanel orders={activity.recent_orders ?? []} formatPrice={formatPrice} />
                <PickupsPanel pickups={activity.pickups ?? []} />
              </div>
            </>
          ) : (
            !loading && (
              <p className="mt-4 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
                Unable to load the charts and recent activity. Try Refresh.
              </p>
            )
          )}

          {branches.length > 1 && <BranchComparison branches={branches} formatPrice={formatPrice} />}
        </div>
      )}
    </div>
  );
}
