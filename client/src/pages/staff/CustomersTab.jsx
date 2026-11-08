import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../api/axios';
import { useCurrency } from '../../context/CurrencyContext.jsx';
import StatusPill from '../../components/StatusPill.jsx';

export function CustomersTab() {
  const { formatPrice } = useCurrency();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [detailById, setDetailById] = useState({});
  const [detailLoading, setDetailLoading] = useState(null);

  const loadCustomers = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get('/admin/customers', { params: search ? { search } : {} })
      .then(({ data }) => setCustomers(data.customers))
      .catch(() => setError('Unable to load customers.'))
      .finally(() => setLoading(false));
  }, [search]);

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const timeout = setTimeout(loadCustomers, 300);
    return () => clearTimeout(timeout);
  }, [loadCustomers]);

  async function toggleCustomer(id) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detailById[id]) {
      setDetailLoading(id);
      try {
        const { data } = await api.get(`/admin/customers/${id}`);
        setDetailById((d) => ({ ...d, [id]: data }));
      } catch {
        setError('Unable to load that customer\'s order history.');
      } finally {
        setDetailLoading(null);
      }
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Customers ({customers.length})</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or username..."
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading customers...</p>}
      {!loading && customers.length === 0 && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No customers found.</p>}

      <div className="mt-4 space-y-3">
        {customers.map((c) => {
          const isOpen = expandedId === c.id;
          const detail = detailById[c.id];
          return (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
              <button
                onClick={() => toggleCustomer(c.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left"
              >
                <div>
                  <p className="font-semibold text-ink-900 dark:text-white">{c.full_name} <span className="font-normal text-slate-400">@{c.username}</span></p>
                  <p className="mt-1 text-xs text-slate-400">
                    {c.email} · {c.phone_number} · {c.location_zone}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>{c.order_count} order{c.order_count === '1' ? '' : 's'}</span>
                  {Number(c.pending_pickup_count) > 0 && (
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-600 dark:bg-brand-900/30">
                      {c.pending_pickup_count} awaiting pickup
                    </span>
                  )}
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/40">
                  {detailLoading === c.id && <p className="text-sm text-slate-500 dark:text-slate-400">Loading order history...</p>}
                  {detail && detail.orders.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No orders yet.</p>
                  )}
                  {detail && detail.orders.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="table-cards w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="px-3 py-2 font-medium">Items</th>
                            <th className="px-3 py-2 font-medium">Drop-off</th>
                            <th className="px-3 py-2 font-medium">Pickup Date</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                            <th className="px-3 py-2 font-medium">Picked Up?</th>
                            <th className="px-3 py-2 text-right font-medium">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {detail.orders.map((o) => (
                            <tr key={o.id}>
                              <td className="px-3 py-2.5 font-medium text-ink-900 dark:text-white">
                                {o.items_summary || `${o.item_count} item(s)`}
                              </td>
                              <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{o.drop_off_date?.slice(0, 10)}</td>
                              <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{o.pickup_date?.slice(0, 10) || '—'}</td>
                              <td className="px-3 py-2.5"><StatusPill status={o.status} /></td>
                              <td className="px-3 py-2.5">
                                {o.picked_up ? (
                                  <span className="flex items-center gap-1 font-semibold text-green-600"><CheckCircle2 size={14} /> Yes</span>
                                ) : (
                                  <span className="text-slate-400">No</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-brand-600">{formatPrice(o.total_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
