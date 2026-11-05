import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Mail,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api from '../api/axios';
import { useBranch } from '../context/BranchContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';

const adminTab = (tab) => `/admin?tab=${tab}`;

function FigureCard({ to, icon: Icon, label, value, detail, urgent = false }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft transition hover:border-violet-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <Icon size={18} className={urgent ? 'text-red-500' : 'text-slate-400'} />
      </div>
      <p className={`mt-3 font-display text-3xl font-semibold ${urgent ? 'text-red-600 dark:text-red-400' : 'text-ink-900 dark:text-white'}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </Link>
  );
}

export default function AdminOverview() {
  const { formatPrice } = useCurrency();
  const { currentBranchId } = useBranch();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranchId]);

  function loadOverview() {
    setLoading(true);
    setError('');
    return api
      .get('/admin/overview', { params: { branch_id: currentBranchId || undefined } })
      .then(({ data }) => setOverview(data))
      .catch(() => setError('Unable to load the overview.'))
      .finally(() => setLoading(false));
  }

  const branches = overview?.by_branch ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Business overview</h2>
        <button onClick={loadOverview} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Refresh
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading && !overview && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Loading overview">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />
          ))}
        </div>
      )}

      {overview && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FigureCard to={adminTab('orders')} icon={ClipboardList} label="Orders today" value={overview.orders_today} detail="Booked or dropped off today" />
            <FigureCard to={adminTab('orders')} icon={CheckCircle2} label="Ready for pickup" value={overview.ready_for_pickup} detail="Waiting for the customer" />
            <FigureCard
              to={adminTab('pickups')}
              icon={AlertTriangle}
              label="Overdue pickups"
              value={overview.overdue_pickups}
              detail={`${overview.late_fees_accruing} accruing late fees`}
              urgent={overview.overdue_pickups > 0}
            />
            <FigureCard to={adminTab('analytics')} icon={TrendingUp} label="Revenue this week" value={formatPrice(overview.revenue_this_week)} detail="Order value since Monday" />
            <FigureCard to={adminTab('payments')} icon={Wallet} label="Outstanding balance" value={formatPrice(overview.outstanding_balance)} detail="Still owed by customers" />
            <FigureCard
              to={adminTab('inventory')}
              icon={Boxes}
              label="Low stock"
              value={overview.low_stock_count}
              detail={overview.low_stock_count === 1 ? 'Item at or below its reorder level' : 'Items at or below their reorder level'}
              urgent={overview.low_stock_count > 0}
            />
            <FigureCard to={adminTab('messages')} icon={Mail} label="Unread messages" value={overview.unread_messages} detail="From the contact page" />
          </div>

          {branches.length > 1 && (
            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
              <h3 className="px-5 pt-5 font-semibold text-ink-900 dark:text-white">Branch comparison</h3>
              <div className="relative mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
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
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {branches.map((branch) => (
                      <tr key={branch.id}>
                        <td className="px-5 py-3 font-medium text-ink-900 dark:text-white">{branch.name}</td>
                        <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{branch.orders_today}</td>
                        <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{branch.ready_for_pickup}</td>
                        <td className={`px-5 py-3 text-right ${branch.overdue_pickups > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
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
          )}
        </>
      )}
    </div>
  );
}
