import { useEffect, useState } from 'react';
import api from '../../api/axios';

export function CapacityTab() {
  const [capacity, setCapacity] = useState([]);
  const [form, setForm] = useState({ date: '', max_orders: 50 });
  const [error, setError] = useState('');

  useEffect(() => {
    loadCapacity();
  }, []);

  function loadCapacity() {
    api.get('/admin/capacity').then(({ data }) => setCapacity(data.capacity)).catch(() => setError('Unable to load capacity.'));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date) return;
    try {
      await api.post('/admin/capacity', form);
      setForm({ date: '', max_orders: 50 });
      loadCapacity();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to set capacity.');
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg text-ink-900 dark:text-white">Daily Order Capacity</h2>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="staff-date" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Date</label>
          <input id="staff-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
        </div>
        <div>
          <label htmlFor="staff-max-orders" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Max Orders</label>
          <input id="staff-max-orders" type="number" min="1" value={form.max_orders} onChange={(e) => setForm({ ...form, max_orders: e.target.value })} className="mt-1 w-28 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
        </div>
        <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Set</button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-soft">
        <div className="overflow-x-auto">
          <table className="table-cards w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Max Orders</th>
                <th className="px-4 py-3 font-medium">Current Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {capacity.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-ink-900 dark:text-white">{c.capacity_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.max_orders}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.current_orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
