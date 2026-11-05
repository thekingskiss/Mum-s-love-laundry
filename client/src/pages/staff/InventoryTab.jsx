import { useEffect, useState } from 'react';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import api from '../../api/axios';

const NEW_INVENTORY_ITEM = { name: '', category: '', unit: 'pieces', quantity_on_hand: '', reorder_threshold: '' };

export function InventoryTab() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adjustDrafts, setAdjustDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [newItem, setNewItem] = useState(NEW_INVENTORY_ITEM);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  function loadItems() {
    setLoading(true);
    api
      .get('/admin/inventory')
      .then(({ data }) => setItems(data.items))
      .catch(() => setError('Unable to load inventory.'))
      .finally(() => setLoading(false));
  }

  async function adjust(item, direction) {
    const raw = adjustDrafts[item.id];
    const amount = Number(raw);
    if (!raw || !(amount > 0)) return;
    setBusyId(item.id);
    setError('');
    try {
      await api.post(`/admin/inventory/${item.id}/adjust`, {
        change_qty: direction === 'add' ? amount : -amount,
        reason: direction === 'add' ? 'Restock' : 'Usage',
      });
      setAdjustDrafts((d) => ({ ...d, [item.id]: '' }));
      loadItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to adjust stock.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(item) {
    try {
      await api.patch(`/admin/inventory/${item.id}`, { is_active: !item.is_active });
      loadItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update that item.');
    }
  }

  async function addItem(e) {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    try {
      await api.post('/admin/inventory', newItem);
      setNewItem(NEW_INVENTORY_ITEM);
      setShowAddForm(false);
      loadItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to add that item.');
    }
  }

  const grouped = items
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .reduce((groups, item) => {
      groups[item.category] = groups[item.category] || [];
      groups[item.category].push(item);
      return groups;
    }, {});

  const lowStockCount = items.filter((i) => i.is_active && i.low_stock).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Inventory ({items.length} items)</h2>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle size={16} /> {lowStockCount} item{lowStockCount === 1 ? '' : 's'} at or below reorder threshold.
        </div>
      )}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {showAddForm && (
        <form onSubmit={addItem} className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
          <input required placeholder="Item name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
          <input required placeholder="Category" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
          <input required placeholder="Unit (e.g. liters)" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
          <input type="number" step="0.01" placeholder="Starting qty" value={newItem.quantity_on_hand} onChange={(e) => setNewItem({ ...newItem, quantity_on_hand: e.target.value })} className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
          <input type="number" step="0.01" placeholder="Reorder at" value={newItem.reorder_threshold} onChange={(e) => setNewItem({ ...newItem, reorder_threshold: e.target.value })} className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
          <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Save</button>
        </form>
      )}

      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading inventory...</p>}

      <div className="mt-6 space-y-8">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand-600">{category}</h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {categoryItems.map((item) => (
                    <tr key={item.id} className={item.is_active ? '' : 'opacity-50'}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-ink-900 dark:text-white">{item.name}</p>
                        {item.low_stock && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={11} /> Low stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {Number(item.quantity_on_hand)} {item.unit}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">Reorder at {Number(item.reorder_threshold)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Qty"
                            value={adjustDrafts[item.id] || ''}
                            onChange={(e) => setAdjustDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                          />
                          <button
                            onClick={() => adjust(item, 'add')}
                            disabled={busyId === item.id}
                            title="Restock"
                            className="rounded-lg bg-green-100 p-1.5 text-green-700 hover:bg-green-200 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-400"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => adjust(item, 'remove')}
                            disabled={busyId === item.id}
                            title="Use / remove stock"
                            className="rounded-lg bg-red-100 p-1.5 text-red-700 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400"
                          >
                            <Minus size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => toggleActive(item)} className="text-xs font-semibold text-slate-400 hover:text-brand-600">
                          {item.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
