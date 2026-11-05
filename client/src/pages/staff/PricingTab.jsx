import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext.jsx';
import { priceLabel } from './shared.jsx';

const PRICE_FIELD_LABEL = 'block text-xs font-semibold text-slate-600 dark:text-slate-300';

const PRICE_FIELD_INPUT =
  'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-ink-900 outline-none transition-colors focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

const NEW_PRICE_ITEM = { item_name: '', category: '', mode: 'fixed', unit_price: '', price_min: '', price_max: '' };

function priceItemDraft(item) {
  return {
    item_name: item.item_name,
    category: item.category,
    mode: item.unit_price != null ? 'fixed' : 'range',
    unit_price: item.unit_price ?? '',
    price_min: item.price_min ?? '',
    price_max: item.price_max ?? '',
  };
}

function priceItemPayload(draft) {
  const details = { item_name: draft.item_name.trim(), category: draft.category.trim() };
  return draft.mode === 'fixed'
    ? { ...details, unit_price: Number(draft.unit_price) }
    : { ...details, price_min: Number(draft.price_min), price_max: Number(draft.price_max) };
}

function PriceItemFields({ draft, onChange }) {
  const set = (patch) => onChange({ ...draft, ...patch });
  const priceInput = (label, field) => (
    <label className={PRICE_FIELD_LABEL}>
      {label}
      <input
        required
        type="number"
        min="0.01"
        step="0.01"
        value={draft[field]}
        onChange={(e) => set({ [field]: e.target.value })}
        className={PRICE_FIELD_INPUT}
      />
    </label>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className={PRICE_FIELD_LABEL}>
        Item name
        <input
          required
          maxLength={150}
          value={draft.item_name}
          onChange={(e) => set({ item_name: e.target.value })}
          className={PRICE_FIELD_INPUT}
        />
      </label>
      <label className={PRICE_FIELD_LABEL}>
        Category
        <input
          required
          maxLength={100}
          list="price-list-categories"
          value={draft.category}
          onChange={(e) => set({ category: e.target.value })}
          className={PRICE_FIELD_INPUT}
        />
      </label>
      <label className={PRICE_FIELD_LABEL}>
        Pricing
        <select
          value={draft.mode}
          onChange={(e) => set({ mode: e.target.value })}
          className={PRICE_FIELD_INPUT}
        >
          <option value="fixed">Fixed price</option>
          <option value="range">Price range</option>
        </select>
      </label>
      {draft.mode === 'fixed' ? (
        priceInput('Price (GHS)', 'unit_price')
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {priceInput('Min (GHS)', 'price_min')}
          {priceInput('Max (GHS)', 'price_max')}
        </div>
      )}
      {draft.mode === 'range' && (
        <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2 lg:col-span-4">
          Orders use the minimum as an estimate until the price is confirmed at drop-off.
        </p>
      )}
    </div>
  );
}

// Staff read the same list as admins, without the controls to change it. The
// server refuses their changes regardless.
export function PricingTab({ canEdit }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(NEW_PRICE_ITEM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState(NEW_PRICE_ITEM);

  useEffect(() => {
    loadItems();
  }, []);

  function loadItems() {
    return api
      .get('/admin/items')
      .then(({ data }) => {
        setItems(data.items);
        setError('');
      })
      .catch(() => setError('Unable to load the price list.'))
      .finally(() => setLoading(false));
  }

  function startEditing(item) {
    setEditingId(item.id);
    setEditDraft(priceItemDraft(item));
  }

  async function saveEdit(e, item) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch(`/admin/items/${item.id}`, priceItemPayload(editDraft));
      setEditingId(null);
      toast.success(`${data.item.item_name} saved.`);
      await loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to save that item.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    setTogglingId(item.id);
    try {
      await api.patch(`/admin/items/${item.id}`, { is_active: !item.is_active });
      toast.success(`${item.item_name} ${item.is_active ? 'deactivated' : 'activated'}.`);
      await loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to update that item.');
    } finally {
      setTogglingId(null);
    }
  }

  async function addItem(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/admin/items', priceItemPayload(newItem));
      setNewItem(NEW_PRICE_ITEM);
      setAdding(false);
      toast.success(`${data.item.item_name} added.`);
      await loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to add that item.');
    } finally {
      setSaving(false);
    }
  }

  const activeCount = items.filter((item) => item.is_active).length;
  const categories = [...new Set(items.map((item) => item.category))];
  const query = search.trim().toLowerCase();
  const visibleItems = items.filter((item) => {
    if (statusFilter === 'active' && !item.is_active) return false;
    if (statusFilter === 'inactive' && item.is_active) return false;
    return !query || `${item.item_name} ${item.category}`.toLowerCase().includes(query);
  });
  const grouped = visibleItems.reduce((groups, item) => {
    groups[item.category] = groups[item.category] || [];
    groups[item.category].push(item);
    return groups;
  }, {});

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-ink-900 dark:text-white">Price list</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {!loading && !error && `${items.length} items, ${activeCount} active. `}
            Prices apply to every branch. Orders already placed keep their original price.
            {!canEdit && ' View only: ask an administrator to change a price.'}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setAdding((open) => !open)}
            aria-expanded={adding}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            {adding ? 'Close' : 'Add item'}
          </button>
        )}
      </div>

      <datalist id="price-list-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      {canEdit && adding && (
        <form onSubmit={addItem} className="mt-4 space-y-3 rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-600">
          <PriceItemFields draft={newItem} onChange={setNewItem} />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            Add to price list
          </button>
        </form>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          aria-label="Search the price list"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items or categories..."
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:max-w-xs"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="all">All items</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</p>}
      {loading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading the price list...</p>}
      {!loading && !error && visibleItems.length === 0 && (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">No items match.</p>
      )}

      <div className="mt-6 space-y-8">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <section key={category} aria-label={category}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-300">
              {category} ({categoryItems.length})
            </h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full text-left text-sm sm:table-fixed">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium sm:w-1/2">Item</th>
                    <th scope="col" className={`px-4 py-2.5 font-medium ${canEdit ? 'sm:w-1/4' : 'sm:w-1/2'}`}>Price</th>
                    {canEdit && <th scope="col" className="px-4 py-2.5 text-right font-medium sm:w-1/4">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {categoryItems.map((item) =>
                    editingId === item.id ? (
                      <tr key={item.id}>
                        <td colSpan={3} className="bg-slate-50 p-4 dark:bg-slate-900/60">
                          <form onSubmit={(e) => saveEdit(e, item)} className="space-y-3" aria-label={`Edit ${item.item_name}`}>
                            <PriceItemFields draft={editDraft} onChange={setEditDraft} />
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={saving}
                                className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.id}>
                        <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-white">
                          <span className={item.is_active ? '' : 'text-slate-500 dark:text-slate-400'}>{item.item_name}</span>
                          {!item.is_active && (
                            <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-2.5 text-slate-700 dark:text-slate-200 ${item.unit_price != null ? 'whitespace-nowrap' : 'sm:whitespace-nowrap'}`}>
                          {priceLabel(item)}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                              <button
                                type="button"
                                onClick={() => startEditing(item)}
                                aria-label={`Edit ${item.item_name}`}
                                className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleActive(item)}
                                disabled={togglingId === item.id}
                                aria-label={`${item.is_active ? 'Deactivate' : 'Activate'} ${item.item_name}`}
                                className="text-xs font-semibold text-slate-500 hover:text-brand-600 disabled:opacity-60 dark:text-slate-400 dark:hover:text-brand-300"
                              >
                                {item.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
