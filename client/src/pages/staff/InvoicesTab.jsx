import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useCurrency } from '../../context/CurrencyContext.jsx';
import { useBranch } from '../../context/BranchContext.jsx';
import InvoiceStatusPill from '../../components/InvoiceStatusPill.jsx';
import { INVOICE_STATUS_LABELS } from '../../lib/invoices';

export function InvoicesTab() {
  const { formatPrice } = useCurrency();
  const { currentBranchId } = useBranch();
  const [invoices, setInvoices] = useState([]);
  const [filters, setFilters] = useState({ status: '', start: '', end: '', search: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(loadInvoices, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentBranchId]);

  function loadInvoices() {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    if (currentBranchId) params.branch_id = currentBranchId;
    api
      .get('/admin/invoices', { params })
      .then(({ data }) => setInvoices(data.invoices))
      .catch(() => setError('Unable to load invoices.'))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <h2 className="font-display text-lg text-ink-900 dark:text-white">Invoices ({invoices.length})</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Generate an invoice from an order in the Order Queue tab — it appears here once created.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-2">
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search invoice # or customer..."
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        >
          <option value="">All statuses</option>
          {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div>
          <label htmlFor="staff-due-from" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Due From</label>
          <input id="staff-due-from"
            type="date"
            value={filters.start}
            onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="staff-due-to" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Due To</label>
          <input id="staff-due-to"
            type="date"
            value={filters.end}
            onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        {(filters.status || filters.start || filters.end || filters.search) && (
          <button
            onClick={() => setFilters({ status: '', start: '', end: '', search: '' })}
            className="text-sm font-semibold text-slate-400 hover:text-brand-600"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading invoices...</p>}
      {!loading && invoices.length === 0 && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No invoices match this filter.</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="table-cards w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice #</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Balance Due</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3">
                    <Link to={`/invoices/${inv.id}`} className="font-semibold text-brand-600 hover:text-brand-700">{inv.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(inv.due_date).toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-ink-900 dark:text-white">{inv.customer_name}</td>
                  <td className="px-4 py-3">
                    <Link to={`/orders/${inv.order_id}/receipt`} className="text-slate-500 hover:text-brand-600 dark:text-slate-400">#{inv.order_id}</Link>
                  </td>
                  <td className="px-4 py-3"><InvoiceStatusPill status={inv.payment_status} /></td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                    {Number(inv.balance_due) > 0 ? formatPrice(inv.balance_due) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink-900 dark:text-white">{formatPrice(inv.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
