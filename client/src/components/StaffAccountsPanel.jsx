import { useState } from 'react';
import { KeyRound, Loader2, UserCheck, UserX } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext.jsx';
import { STAFF_ROLE_OPTIONS, staffActionsFor } from '../lib/staffAccounts';

const ROLE_LABELS = {
  laundry_staff: 'Laundry Staff',
  administrator: 'Administrator',
  super_admin: 'Super Admin',
};

// The staff list with the actions that keep it current: switch an account off
// (a former employee) or back on, change a role, reset a password. Switching
// off takes effect at once: the person is signed out on their next request.
export default function StaffAccountsPanel({ staff = [], currentUser, onChanged }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [passwordId, setPasswordId] = useState(null);
  const [password, setPassword] = useState('');

  async function run(id, request, successMessage) {
    setBusyId(id);
    try {
      await request();
      toast.success(successMessage);
      onChanged();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'That did not work. Please try again.');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function setActive(person, active) {
    const done = await run(
      person.id,
      () => api.patch(`/admin/staff/${person.id}/active`, { active }),
      active ? `${person.full_name} can sign in again.` : `${person.full_name} has been deactivated and signed out.`
    );
    if (done) setConfirmingId(null);
  }

  function changeRole(person, role) {
    if (role === person.role) return;
    run(person.id, () => api.patch(`/admin/staff/${person.id}`, { role }), `${person.full_name} is now ${ROLE_LABELS[role]}.`);
  }

  async function resetPassword(event, person) {
    event.preventDefault();
    const done = await run(
      person.id,
      () => api.post(`/admin/staff/${person.id}/password`, { password }),
      `Password updated for ${person.full_name}. They have been signed out everywhere.`
    );
    if (done) {
      setPasswordId(null);
      setPassword('');
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Role</th>
              <th scope="col" className="px-4 py-3 font-medium">Branch</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {staff.map((person) => {
              const actions = staffActionsFor(currentUser, person);
              const inactive = person.is_active === false;
              const busy = busyId === person.id;
              return (
                <tr key={person.id} className={inactive ? 'bg-slate-50/60 dark:bg-slate-900/40' : undefined}>
                  <td className="px-4 py-3">
                    <p className={`font-medium ${inactive ? 'text-slate-500 line-through' : 'text-ink-900 dark:text-white'}`}>
                      {person.full_name}
                    </p>
                    <p className="text-xs text-slate-400">{person.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {actions.changeRole ? (
                      <select
                        aria-label={`Role for ${person.full_name}`}
                        value={person.role}
                        disabled={busy}
                        onChange={(e) => changeRole(person, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        {STAFF_ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : (
                      ROLE_LABELS[person.role] || person.role
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{person.branch_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        inactive ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'
                      }`}
                    >
                      {inactive ? 'Deactivated' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!actions.toggleActive && !actions.resetPassword ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : passwordId === person.id ? (
                      <form onSubmit={(e) => resetPassword(e, person)} className="flex flex-wrap items-center gap-2">
                        <input
                          type="password"
                          required
                          minLength={8}
                          autoFocus
                          autoComplete="new-password"
                          aria-label={`New password for ${person.full_name}`}
                          placeholder="New password (8+ characters)"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-44 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700"
                        />
                        <button type="submit" disabled={busy} className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                          {busy ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                        </button>
                        <button type="button" onClick={() => { setPasswordId(null); setPassword(''); }} className="text-xs text-slate-500 hover:underline">
                          Cancel
                        </button>
                      </form>
                    ) : confirmingId === person.id ? (
                      <div className="flex flex-wrap items-center gap-2" role="alert">
                        <span className="text-xs text-slate-600 dark:text-slate-300">Sign {person.full_name} out and block access?</span>
                        <button type="button" disabled={busy} onClick={() => setActive(person, false)} className="rounded-lg bg-danger px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
                          {busy ? <Loader2 size={12} className="animate-spin" /> : 'Deactivate'}
                        </button>
                        <button type="button" onClick={() => setConfirmingId(null)} className="text-xs text-slate-500 hover:underline">
                          Keep
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        {actions.toggleActive && (inactive ? (
                          <button type="button" disabled={busy} onClick={() => setActive(person, true)} className="flex items-center gap-1 text-xs font-semibold text-success hover:underline disabled:opacity-60">
                            <UserCheck size={14} /> Reactivate
                          </button>
                        ) : (
                          <button type="button" onClick={() => setConfirmingId(person.id)} className="flex items-center gap-1 text-xs font-semibold text-danger hover:underline">
                            <UserX size={14} /> Deactivate
                          </button>
                        ))}
                        {actions.resetPassword && (
                          <button type="button" onClick={() => { setPasswordId(person.id); setPassword(''); }} className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:underline dark:text-slate-300">
                            <KeyRound size={14} /> Reset password
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {staff.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No staff accounts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
