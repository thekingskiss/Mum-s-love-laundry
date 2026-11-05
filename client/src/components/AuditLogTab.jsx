import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AuditLogTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/audit-log')
      .then(({ data }) => setEntries(data.entries))
      .catch(() => setError('Unable to load the audit log.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Who changed staff accounts, branches and prices, voided invoices or deleted expenses. Showing the latest 200.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading the audit log...</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="mt-4 rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-500 shadow-soft dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Nothing recorded yet.
        </p>
      )}

      {entries.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Who</th>
                  <th className="px-5 py-3 font-medium">What changed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{entry.actor_name || entry.actor_email}</td>
                    <td className="px-5 py-3 font-medium text-ink-900 dark:text-white">{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
