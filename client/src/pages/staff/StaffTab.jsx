import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../api/axios';
import { useBranch } from '../../context/BranchContext.jsx';
import StaffAccountsPanel from '../../components/StaffAccountsPanel.jsx';

export function StaffTab({ user }) {
  const { branches, isSuperAdmin } = useBranch();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone_number: '', location_zone: '', role: 'laundry_staff', branch_id: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  function loadStaff() {
    setLoading(true);
    api.get('/admin/staff').then(({ data }) => setStaff(data.staff)).catch(() => setError('Unable to load staff.')).finally(() => setLoading(false));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/admin/staff', form);
      setForm({ email: '', password: '', full_name: '', phone_number: '', location_zone: '', role: 'laundry_staff', branch_id: '' });
      loadStaff();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create staff account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Staff Accounts</h2>
        {loading && <p className="mt-3 text-sm text-slate-500">Loading...</p>}
        {/* A super admin sees this error under the Add Staff form instead. */}
        {error && !isSuperAdmin && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        <StaffAccountsPanel staff={staff} currentUser={user} onChanged={loadStaff} />
      </div>

      {/* Only a super admin can create accounts (the server enforces this too). */}
      {isSuperAdmin && (
      <div>
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Add Staff</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-soft">
          <input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
          <input required placeholder="Phone number" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
          <input required placeholder="Location zone" value={form.location_zone} onChange={(e) => setForm({ ...form, location_zone: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400">
            <option value="laundry_staff">Laundry Staff</option>
            <option value="administrator">Administrator</option>
          </select>
          {isSuperAdmin && (
            <select required value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400">
              <option value="">Assign to branch...</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input required type="password" minLength={8} placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {submitting && <Loader2 size={14} className="animate-spin" />} Create Account
          </button>
        </form>
      </div>
      )}
    </div>
  );
}
