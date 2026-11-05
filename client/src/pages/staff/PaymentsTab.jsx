import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useCurrency } from '../../context/CurrencyContext.jsx';
import { useBranch } from '../../context/BranchContext.jsx';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
} from '../../lib/payments';

export function PaymentsTab() {
  const { formatPrice } = useCurrency();
  const { currentBranchId } = useBranch();
  const [payments, setPayments] = useState([]);
  const [totals, setTotals] = useState({ total_collected: 0, total_refunded: 0 });
  const [filters, setFilters] = useState({ start: '', end: '', payment_method: '', payment_type: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentBranchId]);

  function loadPayments() {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    if (currentBranchId) params.branch_id = currentBranchId;
    api
      .get('/admin/payments', { params })
      .then(({ data }) => {
        setPayments(data.payments);
        setTotals({ total_collected: data.total_collected, total_refunded: data.total_refunded });
      })
      .catch(() => setError('Unable to load transactions.'))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <h2 className="font-display text-lg text-ink-900 dark:text-white">Transactions ({payments.length})</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Collected</p>
          <p className="mt-2 font-display text-2xl text-green-600">{formatPrice(totals.total_collected)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Refunded</p>
          <p className="mt-2 font-display text-2xl text-red-600">{formatPrice(totals.total_refunded)}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="staff-from" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">From</label>
          <input id="staff-from"
            type="date"
            value={filters.start}
            onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="staff-to" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">To</label>
          <input id="staff-to"
            type="date"
            value={filters.end}
            onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <select
          value={filters.payment_method}
          onChange={(e) => setFilters((f) => ({ ...f, payment_method: e.target.value }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        >
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select
          value={filters.payment_type}
          onChange={(e) => setFilters((f) => ({ ...f, payment_type: e.target.value }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        >
          <option value="">All types</option>
          {PAYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {(filters.start || filters.end || filters.payment_method || filters.payment_type) && (
          <button
            onClick={() => setFilters({ start: '', end: '', payment_method: '', payment_type: '' })}
            className="text-sm font-semibold text-slate-400 hover:text-brand-600"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading transactions...</p>}
      {!loading && payments.length === 0 && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No transactions match this filter.</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Recorded By</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(p.paid_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Link to={`/orders/${p.order_id}/receipt`} className="font-semibold text-brand-600 hover:text-brand-700">#{p.order_id}</Link>
                  </td>
                  <td className="px-4 py-3 text-ink-900 dark:text-white">{p.customer_name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.recorded_by_name || '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${p.payment_type === 'refund' ? 'text-red-600' : 'text-green-600'}`}>
                    {p.payment_type === 'refund' ? '-' : '+'}{formatPrice(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
