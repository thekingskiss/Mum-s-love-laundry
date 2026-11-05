import { useEffect, useState } from 'react';
import api from '../../api/axios';

export function ZonesTab() {
  const [zones, setZones] = useState([]);
  const [newZone, setNewZone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadZones();
  }, []);

  function loadZones() {
    api.get('/admin/zones').then(({ data }) => setZones(data.zones)).catch(() => setError('Unable to load zones.'));
  }

  async function toggle(id, field, value) {
    try {
      await api.patch(`/admin/zones/${id}`, { [field]: value });
      loadZones();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update zone.');
    }
  }

  async function addZone(e) {
    e.preventDefault();
    if (!newZone.trim()) return;
    try {
      await api.post('/admin/zones', { zone_name: newZone.trim() });
      setNewZone('');
      loadZones();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to add zone.');
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg text-ink-900 dark:text-white">Customer Areas</h2>
      <p className="mt-1 text-sm text-slate-500">
        Informational only — the towns customers register from. Doesn't affect drop-off since customers bring
        laundry in themselves.
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={addZone} className="mt-4 flex max-w-md gap-2">
        <input value={newZone} onChange={(e) => setNewZone(e.target.value)} placeholder="New area name" className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
        <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Add</button>
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {zones.map((z) => (
                <tr key={z.id}>
                  <td className="px-4 py-3 font-medium text-ink-900 dark:text-white">{z.zone_name}</td>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={z.is_active} onChange={(e) => toggle(z.id, 'is_active', e.target.checked)} className="h-4 w-4 accent-brand-500" />
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
