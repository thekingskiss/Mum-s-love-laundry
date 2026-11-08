import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../api/axios';

export function BranchesTab() {
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBranches();
  }, []);

  function loadBranches() {
    setLoading(true);
    api
      .get('/admin/branches')
      .then(({ data }) => setBranches(data.branches))
      .catch(() => setError('Unable to load branches.'))
      .finally(() => setLoading(false));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/admin/branches', form);
      setForm({ name: '', address: '', phone: '', email: '' });
      loadBranches();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create that branch.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(id, is_active) {
    try {
      await api.patch(`/admin/branches/${id}`, { is_active });
      loadBranches();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update that branch.');
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Branches</h2>
        {loading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading...</p>}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="table-cards w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-medium text-ink-900 dark:text-white">{b.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{b.address || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{b.phone || b.email || '—'}</td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={b.is_active}
                        onChange={(e) => toggleActive(b.id, e.target.checked)}
                        className="h-4 w-4 accent-brand-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Add Branch</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <input
            required
            placeholder="Branch name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />} Create Branch
          </button>
        </form>
      </div>
    </div>
  );
}
