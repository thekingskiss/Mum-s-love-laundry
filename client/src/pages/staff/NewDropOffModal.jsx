import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react';
import api from '../../api/axios';
import { useBranch } from '../../context/BranchContext.jsx';
import { priceLabel, todayISO } from './shared.jsx';

function itemPrice(item) {
  return item.unit_price != null ? Number(item.unit_price) : Number(item.price_min);
}

// Lets staff record a walk-in drop-off directly — for an existing customer
// found by search, or a brand-new one entered on the spot. The customer
// doesn't have to be the one physically present (dropped_off_by notes who
// actually brought the items in, e.g. a friend or family member).
export function NewDropOffModal({ onClose, onCreated }) {
  const { currentBranchId } = useBranch();
  const [items, setItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [cart, setCart] = useState({});
  const [mode, setMode] = useState('existing');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ full_name: '', phone_number: '', email: '', location_zone: '' });
  const [droppedOffBy, setDroppedOffBy] = useState('');
  const [dropOffDate, setDropOffDate] = useState(todayISO());
  const [pickupDate, setPickupDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/items').then(({ data }) => setItems(data.items)).catch(() => setItems([]));
    api.get('/zones').then(({ data }) => setZones(data.zones)).catch(() => setZones([]));
  }, []);

  useEffect(() => {
    if (mode !== 'existing' || !customerSearch.trim()) {
      setCustomerResults([]);
      return undefined;
    }
    const timeout = setTimeout(() => {
      api
        .get('/admin/customers', { params: { search: customerSearch } })
        .then(({ data }) => setCustomerResults(data.customers))
        .catch(() => setCustomerResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerSearch, mode]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const item = itemsById.get(Number(id));
          return item ? { item, quantity: qty, lineTotal: itemPrice(item) * qty } : null;
        })
        .filter(Boolean),
    [cart, itemsById]
  );
  const cartTotal = cartLines.reduce((sum, l) => sum + l.lineTotal, 0);

  const groupedItems = useMemo(() => {
    const filtered = items.filter((i) => i.item_name.toLowerCase().includes(itemSearch.toLowerCase()));
    const groups = {};
    for (const item of filtered) {
      groups[item.category] = groups[item.category] || [];
      groups[item.category].push(item);
    }
    return groups;
  }, [items, itemSearch]);

  function setQuantity(itemId, quantity) {
    setCart((c) => ({ ...c, [itemId]: Math.max(0, quantity) }));
  }

  const hasCustomer =
    mode === 'existing'
      ? Boolean(selectedCustomer)
      : Boolean(newCustomer.full_name.trim() && newCustomer.phone_number.trim() && newCustomer.location_zone);
  const canSubmit = hasCustomer && cartLines.length > 0 && dropOffDate && !submitting;

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        drop_off_date: dropOffDate,
        pickup_date: pickupDate || undefined,
        dropped_off_by: droppedOffBy.trim() || undefined,
        branch_id: currentBranchId || undefined,
        items: cartLines.map((l) => ({ laundry_item_id: l.item.id, quantity: l.quantity })),
      };
      if (mode === 'existing') {
        payload.customer_id = selectedCustomer.id;
      } else {
        payload.new_customer = {
          full_name: newCustomer.full_name.trim(),
          phone_number: newCustomer.phone_number.trim(),
          location_zone: newCustomer.location_zone,
          email: newCustomer.email.trim() || undefined,
        };
      }
      const { data } = await api.post('/admin/orders', payload);
      onCreated(data.order);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create this drop-off.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">New Drop-off</h2>
            <p className="text-xs text-slate-400">Record a customer's items, even if someone else brought them in.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div>
            <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Customer</h3>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  mode === 'existing'
                    ? 'border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-900/30'
                    : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-300'
                }`}
              >
                Existing customer
              </button>
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  mode === 'new'
                    ? 'border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-900/30'
                    : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-300'
                }`}
              >
                New customer
              </button>
            </div>

            {mode === 'existing' ? (
              <div className="mt-3">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm dark:border-brand-900/50 dark:bg-brand-900/20">
                    <span className="font-medium text-ink-900 dark:text-white">
                      {selectedCustomer.full_name} · {selectedCustomer.phone_number}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search by name, email, or username..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                    {customerResults.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-600 dark:bg-slate-800">
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerResults([]);
                              setCustomerSearch('');
                            }}
                            className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                          >
                            <span className="font-medium text-ink-900 dark:text-white">{c.full_name}</span>
                            <span className="text-xs text-slate-400">{c.phone_number} · {c.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={newCustomer.full_name}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, full_name: e.target.value }))}
                  placeholder="Full name"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
                <input
                  value={newCustomer.phone_number}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, phone_number: e.target.value }))}
                  placeholder="Phone number"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
                <input
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                  placeholder="Email (optional)"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
                <select
                  value={newCustomer.location_zone}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, location_zone: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Area...</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.zone_name}>{z.zone_name}</option>
                  ))}
                </select>
              </div>
            )}

            <input
              value={droppedOffBy}
              onChange={(e) => setDroppedOffBy(e.target.value)}
              placeholder="Dropped off by someone else? Note who (optional)"
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Items brought in</h3>
            <div className="relative mt-2">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div className="mt-3 max-h-64 space-y-4 overflow-y-auto rounded-lg border border-slate-100 p-3 dark:border-slate-700">
              {Object.entries(groupedItems).map(([category, categoryItems]) => (
                <div key={category}>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-brand-600">{category}</h4>
                  <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
                    {categoryItems.map((item) => {
                      const qty = cart[item.id] || 0;
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-ink-900 dark:text-white">{item.item_name}</p>
                            <p className="text-xs text-slate-400">{priceLabel(item)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setQuantity(item.id, qty - 1)}
                              disabled={qty === 0}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-30 dark:border-slate-600"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="w-5 text-center text-sm font-semibold text-ink-900 dark:text-white">{qty}</span>
                            <button
                              type="button"
                              onClick={() => setQuantity(item.id, qty + 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-600"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {Object.keys(groupedItems).length === 0 && <p className="text-sm text-slate-400">No items match.</p>}
            </div>
            {cartLines.length > 0 && (
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{cartLines.reduce((n, l) => n + l.quantity, 0)} item(s)</span>
                <span className="font-semibold text-brand-600">GHS {cartTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="staff-drop-off-date" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Drop-off date</label>
              <input id="staff-drop-off-date"
                type="date"
                value={dropOffDate}
                onChange={(e) => setDropOffDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="staff-pickup-date-optional" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Pickup date (optional)</label>
              <input id="staff-pickup-date-optional"
                type="date"
                min={dropOffDate}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />} Create Drop-off
          </button>
        </div>
      </div>
    </div>
  );
}
