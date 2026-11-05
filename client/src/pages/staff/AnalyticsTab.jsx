import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, BarChart3 } from 'lucide-react';
import api from '../../api/axios';
import { useCurrency } from '../../context/CurrencyContext.jsx';
import { useBranch } from '../../context/BranchContext.jsx';
import AnimatedNumber from '../../components/AnimatedNumber.jsx';

const SALES_PERIODS = [
  { key: 'daily_sales', label: 'Daily (30d)' },
  { key: 'monthly_sales', label: 'Monthly (12mo)' },
  { key: 'yearly_sales', label: 'Yearly' },
];

function formatPeriodLabel(periodKey, period) {
  if (periodKey === 'yearly_sales') return period;
  if (periodKey === 'monthly_sales') {
    return new Date(`${period}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  return period;
}

export function AnalyticsTab() {
  const { formatPrice } = useCurrency();
  const { currentBranchId } = useBranch();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [periodKey, setPeriodKey] = useState('daily_sales');

  useEffect(() => {
    setLoading(true);
    setError('');

    api
      .get('/admin/analytics', {
        params: { branch_id: currentBranchId || undefined },
      })
      .then(({ data }) => setData(data))
      .catch(() => setError('Unable to load analytics.'))
      .finally(() => setLoading(false));
  }, [currentBranchId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {error}
      </p>
    );
  }

  if (!data) return null;

  const trend = Array.isArray(data[periodKey]) ? data[periodKey] : [];

const normalizedTrend = trend.map((item) => ({
  ...item,
  revenue: Number(item.revenue) || 0,
  expenses: Number(item.expenses) || 0,
  net: Number(item.net) || 0,
  order_count: Number(item.order_count) || 0,
}));

const maxRevenue = Math.max(
  1,
  ...normalizedTrend.map((item) =>
    Math.max(item.revenue, item.expenses)
  )
);

  const totalStatusOrders = data.orders_by_status.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );

  const statusBarClasses = {
    pending: 'bg-amber-400',
    washing: 'bg-blue-400',
    ready: 'bg-violet-400',
    completed: 'bg-emerald-500',
    cancelled: 'bg-slate-400',
    picked_up: 'bg-emerald-600',
  };

 const statusLabels = {
  pending: 'Pending',
  order_received: 'Order Received',
  washing: 'Washing',
  in_washing: 'In Washing',
  ready: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
  picked_up: 'Picked Up',
};
    return (
  <div className="w-full">
  <div className="w-full p-0">

            {/* Page heading */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-5">

        {/* Left side */}
        <div>
          {/* Breadcrumb */}
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
            <span className="text-slate-400">
              Admin
            </span>

            <span className="text-slate-300">
              /
            </span>

            <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-slate-600 dark:text-slate-300 shadow-sm">
              Analytics
            </span>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor sales, orders, expenses, and outstanding balances.
          </p>
        </div>

        {/* Live dashboard badge */}
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-700 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>

          <span className="text-xs font-semibold">
            Live dashboard
          </span>
        </div>

      </div>

      {data.low_stock_count > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <AlertTriangle size={17} />
            </div>

            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {data.low_stock_count} inventory item
                {data.low_stock_count === 1 ? ' is' : 's are'} running low
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Review stock levels before they run out.
              </p>
            </div>
          </div>

          <Link
            to="/admin?tab=inventory"
            className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 dark:border-amber-800 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-950/50"
          >
            View inventory
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: 'Total Orders',
            value: data.total_orders,
            description: 'Orders recorded',
            accent: 'text-slate-900 dark:text-white',
            format: undefined,
          },
          {
            label: 'Total Revenue',
            value: data.total_revenue,
            description: 'Gross sales',
            accent: 'text-slate-900 dark:text-white',
            format: formatPrice,
          },
          {
            label: 'Total Expenses',
            value: data.total_expenses,
            description: 'Recorded expenses',
            accent: 'text-slate-900 dark:text-white',
            format: formatPrice,
          },
          {
            label: 'Net Profit',
            value: data.net_profit,
            description: 'Revenue minus expenses',
            accent: data.net_profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white',
            format: formatPrice,
          },
          {
            label: 'Outstanding Balance',
            value: data.outstanding_balance,
            description: 'Amount still owed',
            accent:
              data.outstanding_balance > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-slate-900 dark:text-white',
            format: formatPrice,
          },
        ].map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group rounded-2xl border border-white/60 bg-white/95 dark:border-slate-700 dark:bg-slate-800 p-5 shadow-lg shadow-blue-950/10 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-xl"          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              {metric.label}
            </p>

            <p
              className={`mt-3 font-display text-2xl font-semibold ${metric.accent}`}
              style={{
                fontVariantNumeric: 'lining-nums tabular-nums',
              }}
            >
              <AnimatedNumber
                value={metric.value}
                format={metric.format}
              />
            </p>

            <p className="mt-2 text-xs text-slate-400">
              {metric.description}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Sales trend */}
<div className="mt-6 rounded-2xl border border-white/60 bg-white/95 dark:border-slate-700 dark:bg-slate-800 p-5 shadow-lg shadow-blue-950/10 backdrop-blur-sm sm:p-6">
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        Sales Trend
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        Revenue and expense activity over time
      </p>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
          Revenue
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          Expenses
        </div>
      </div>
    </div>

    <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1">
      {SALES_PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => setPeriodKey(p.key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            periodKey === p.key
              ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  </div>

  {normalizedTrend.length === 0 ? (
    <div className="mt-6 flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-slate-400 shadow-sm">
        <BarChart3 size={20} />
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        No sales in this period
      </p>

      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
        There are no recorded sales for the selected date range.
        Try another range to view your sales trend.
      </p>

      {periodKey !== 'monthly_sales' && (
        <button
          type="button"
          onClick={() => setPeriodKey('monthly_sales')}
          className="mt-4 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          View monthly sales
        </button>
      )}
    </div>
  ) : (
    <div className="mt-6">
      <div className="relative h-56">
        {/* Grid lines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3, 4].map((line) => (
            <div
              key={line}
              className="border-t border-slate-100 dark:border-slate-700"
            />
          ))}
        </div>
        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
          {normalizedTrend.map((d, i) => {
            const revenueHeight = Math.max(
              2,
              (d.revenue / maxRevenue) * 100
            );

            const expenseHeight =
              d.expenses > 0
                ? Math.max(
                    2,
                    (d.expenses / maxRevenue) * 100
                  )
                : 0;

            return (
              <div
                key={d.period}
                className="group relative flex h-full flex-1 items-end justify-center gap-1"
              >
                <div className="flex h-full w-full items-end justify-center gap-1">

                  {/* Revenue */}
                  <motion.div
                    className="w-[42%] rounded-t-md bg-brand-500 transition-colors group-hover:bg-brand-600"
                    style={{
                      height: `${revenueHeight}%`,
                    }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 200,
                      damping: 20,
                      delay: Math.min(i * 0.015, 0.5),
                    }}
                  />

                  {/* Expenses */}
                  {d.expenses > 0 && (
                    <motion.div
                      className="w-[42%] rounded-t-md bg-amber-400 transition-colors group-hover:bg-amber-500"
                      style={{
                        height: `${expenseHeight}%`,
                      }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 200,
                        damping: 20,
                        delay: Math.min(
                          i * 0.015 + 0.03,
                          0.5
                        ),
                      }}
                    />
                  )}

                </div>

                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                  <p className="font-semibold">
                    {formatPeriodLabel(
                      periodKey,
                      d.period
                    )}
                  </p>

                  <p className="mt-1">
                    Revenue: {formatPrice(d.revenue)}
                  </p>

                  <p>
                    {d.order_count} order
                    {d.order_count === 1 ? '' : 's'}
                  </p>

                  {d.expenses > 0 && (
                    <p>
                      Expenses:{' '}
                      {formatPrice(d.expenses)}
                    </p>
                  )}

                  <p>
                    Net: {formatPrice(d.net)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Period labels */}
      <div className="mt-3 flex gap-1.5 sm:gap-2">
        {normalizedTrend.map((d) => (
          <div
            key={d.period}
            className="min-w-0 flex-1 text-center text-[10px] text-slate-400"
          >
            {formatPeriodLabel(periodKey, d.period)}
          </div>
        ))}
      </div>
    </div>
  )}
</div>

      {/* Status + busiest dates */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Orders by status */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Orders by Status
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Current order distribution
            </p>
          </div>

          {totalStatusOrders > 0 ? (
            <>
              <div className="mt-6 flex h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                {data.orders_by_status.map((s) => (
                  <div
                    key={s.status}
                    className={
                      statusBarClasses[s.status] || 'bg-slate-300'
                    }
                    style={{
                      width: `${(Number(s.count) / totalStatusOrders) * 100}%`,
                    }}
                    title={`${statusLabels[s.status] || s.status}: ${s.count}`}
                  />
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
                {data.orders_by_status.map((s) => (
                  <div
                    key={s.status}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          statusBarClasses[s.status] || 'bg-slate-300'
                        }`}
                      />
                      <span className="truncate text-slate-600 dark:text-slate-300">
                        {statusLabels[s.status] || s.status}
                      </span>
                    </div>

                    <span
                      className="font-semibold text-slate-900 dark:text-white"
                      style={{
                        fontVariantNumeric: 'lining-nums tabular-nums',
                      }}
                    >
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-400">
              No order status data available.
            </p>
          )}
        </div>

        {/* Busiest dates */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm sm:p-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Busiest Drop-off Dates
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Dates with the highest number of orders
            </p>
          </div>

          {data.busiest_dates.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">
              Not enough data yet.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {data.busiest_dates.map((b, index) => {
                const maxDateOrders = Math.max(
                  1,
                  ...data.busiest_dates.map((item) =>
                    Number(item.order_count) || 0
                  )
                );

                const width =
                  (Number(b.order_count) / maxDateOrders) * 100;

                return (
                  <div key={b.drop_off_date}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {new Date(b.drop_off_date)
                          .toISOString()
                          .slice(0, 10)}
                      </span>

                      <span
                        className="font-semibold text-slate-900 dark:text-white"
                        style={{
                          fontVariantNumeric: 'lining-nums tabular-nums',
                        }}
                      >
                        {b.order_count} order
                        {b.order_count === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{
                          duration: 0.5,
                          delay: index * 0.05,
                        }}
                        className="h-full rounded-full bg-brand-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
