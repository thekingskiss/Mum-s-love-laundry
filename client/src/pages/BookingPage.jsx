import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, Minus, Plus, Search } from 'lucide-react';
import api from '../api/axios';
import Skeleton from '../components/Skeleton.jsx';
import { SHOP_ADDRESS, SHOP_HOURS } from '../lib/shopInfo.js';

const STEPS = ['Items', 'Drop-off Date', 'Confirm'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function itemPrice(item) {
  return item.unit_price != null ? Number(item.unit_price) : Number(item.price_min);
}

function priceLabel(item) {
  if (item.unit_price != null) return `GHS ${Number(item.unit_price).toFixed(2)}`;
  return `GHS ${Number(item.price_min).toFixed(2)}–${Number(item.price_max).toFixed(2)}`;
}

export default function BookingPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({}); // { [itemId]: quantity }
  const [dropOffDate, setDropOffDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [capacity, setCapacity] = useState(null);
  const [checkingCapacity, setCheckingCapacity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  useEffect(() => {
    api
      .get('/items')
      .then(({ data }) => setItems(data.items))
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false));
    api
      .get('/branches')
      .then(({ data }) => {
        setBranches(data.branches);
        if (data.branches.length === 1) setBranchId(String(data.branches[0].id));
      })
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (!dropOffDate || !branchId) return undefined;
    setCheckingCapacity(true);
    setCapacity(null);
    const timeout = setTimeout(() => {
      api
        .get('/capacity/check', { params: { date: dropOffDate, branch_id: branchId } })
        .then(({ data }) => setCapacity(data))
        .catch(() => setCapacity(null))
        .finally(() => setCheckingCapacity(false));
    }, 200);
    return () => clearTimeout(timeout);
  }, [dropOffDate, branchId]);

  const selectedBranch = branches.find((b) => String(b.id) === String(branchId));

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
  const hasEstimatedItems = cartLines.some((l) => l.item.unit_price == null);

  const groupedItems = useMemo(() => {
    const filtered = items.filter((i) => i.item_name.toLowerCase().includes(search.toLowerCase()));
    const groups = {};
    for (const item of filtered) {
      groups[item.category] = groups[item.category] || [];
      groups[item.category].push(item);
    }
    return groups;
  }, [items, search]);

  function setQuantity(itemId, quantity) {
    setCart((c) => ({ ...c, [itemId]: Math.max(0, quantity) }));
  }

  const canGoNext =
    (step === 0 && cartLines.length > 0) ||
    (step === 1 && dropOffDate && branchId && capacity?.available !== false) ||
    step === 2;

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/orders', {
        drop_off_date: dropOffDate,
        branch_id: branchId,
        items: cartLines.map((l) => ({ laundry_item_id: l.item.id, quantity: l.quantity })),
        notes: notes.trim() || undefined,
      });
      setOrder(data.order);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to submit your order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 3 && order) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 pb-16 pt-10 text-center"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
        >
          <Check size={32} />
        </motion.span>
        <h1 className="mt-6 font-display text-2xl font-semibold text-ink-900">Order booked!</h1>
        <p className="mt-2 text-slate-500">
          Bring in {cartLines.reduce((n, l) => n + l.quantity, 0)} item{cartLines.length === 1 ? '' : 's'} on{' '}
          <strong>{order.drop_off_date?.slice(0, 10)}</strong> and we'll take care of the rest.
        </p>
        <p className="mt-1 text-lg font-semibold text-brand-600">GHS {Number(order.total_price).toFixed(2)}</p>

        <div className="mt-6 flex flex-col gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600 sm:flex-row sm:gap-6">
          <span className="flex items-center gap-2">
            <MapPin size={15} className="text-brand-500" /> {SHOP_ADDRESS}
          </span>
          <span className="flex items-center gap-2">
            <Clock size={15} className="text-brand-500" /> {SHOP_HOURS}
          </span>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/dashboard')}
          className="mt-8 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Go to Dashboard
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
      <h1 className="font-display text-3xl font-semibold text-ink-900">Book a Drop-off</h1>
      <p className="mt-2 text-slate-500">Choose your items and a date, then bring your laundry in to our shop.</p>

      {/* Stepper */}
      <div className="mt-8 flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className={`flex items-center ${i === STEPS.length - 1 ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                  i <= step ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i < step ? <Check size={16} /> : i + 1}
              </div>
              <span className={`mt-2 hidden text-xs font-medium sm:block ${i <= step ? 'text-ink-900' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i !== STEPS.length - 1 && <div className={`mx-2 h-0.5 flex-1 ${i < step ? 'bg-brand-500' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-slate-100 bg-white p-8 shadow-soft">
        <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step-0"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold text-ink-900">What are you bringing in?</h2>
              <div className="relative mt-4">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search items (e.g. shirt, bedsheet, suit)"
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div className="mt-6 max-h-[32rem] space-y-8 overflow-y-auto pr-1">
                {loadingItems ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <Skeleton className="h-7 w-20" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {Object.entries(groupedItems).map(([category, categoryItems]) => (
                      <div key={category}>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-brand-600">{category}</h3>
                        <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
                          {categoryItems.map((item) => {
                            const qty = cart[item.id] || 0;
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-ink-900">{item.item_name}</p>
                                  <p className="text-xs text-slate-400">{priceLabel(item)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.85 }}
                                    onClick={() => setQuantity(item.id, qty - 1)}
                                    disabled={qty === 0}
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-30"
                                  >
                                    <Minus size={13} />
                                  </motion.button>
                                  <span className="w-5 text-center text-sm font-semibold text-ink-900">{qty}</span>
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.85 }}
                                    onClick={() => setQuantity(item.id, qty + 1)}
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-600"
                                  >
                                    <Plus size={13} />
                                  </motion.button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {Object.keys(groupedItems).length === 0 && (
                      <p className="text-sm text-slate-400">No items match "{search}".</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink-900">Your Order</h3>
              {cartLines.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No items selected yet.</p>
              ) : (
                <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  {cartLines.map((l) => (
                    <div key={l.item.id} className="flex justify-between text-xs text-slate-600">
                      <span>{l.item.item_name} x{l.quantity}</span>
                      <span className="font-medium text-ink-900">GHS {l.lineTotal.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-brand-600">
                    <span>Total</span>
                    <span>GHS {cartTotal.toFixed(2)}</span>
                  </div>
                  {hasEstimatedItems && (
                    <p className="pt-1 text-[11px] text-slate-400">
                      Some items have a price range — we'll confirm the exact price when you drop off.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <h2 className="text-lg font-semibold text-ink-900">Choose a branch and drop-off date</h2>
            <p className="mt-1 text-sm text-slate-500">Bring your laundry in to this branch on this date, during business hours.</p>

            {branches.length > 1 && (
              <div className="mt-5 max-w-sm">
                <label className="text-sm font-semibold text-ink-900">Branch</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Select a branch...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}{b.address ? ` — ${b.address}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <input
              type="date"
              min={todayISO()}
              value={dropOffDate}
              onChange={(e) => setDropOffDate(e.target.value)}
              className="mt-5 w-full max-w-sm rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />

            {checkingCapacity && <p className="mt-3 text-xs text-slate-400">Checking availability...</p>}
            {!checkingCapacity && capacity?.available === false && (
              <div className="mt-3 flex max-w-sm items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                <AlertTriangle size={14} className="shrink-0" /> Fully booked for this date — please choose another.
              </div>
            )}
            {!checkingCapacity && capacity?.available === true && (
              <div className="mt-3 flex max-w-sm items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                <CheckCircle2 size={14} className="shrink-0" /> Slots available for this date.
              </div>
            )}

            <div className="mt-6">
              <label className="text-sm font-semibold text-ink-900">Special instructions (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. starch this shirt, handle with care, separate colors..."
                className="mt-2 w-full max-w-sm resize-none rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <h2 className="text-lg font-semibold text-ink-900">Review your order</h2>

            <div className="mt-6 space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4">
              {cartLines.map((l) => (
                <div key={l.item.id} className="flex justify-between text-sm text-slate-600">
                  <span>{l.item.item_name} x{l.quantity}</span>
                  <span className="font-medium text-ink-900">GHS {l.lineTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <div className="flex justify-between py-3">
                <dt className="text-slate-500">Drop-off Date</dt>
                <dd className="font-medium text-ink-900">{dropOffDate}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-slate-500">Total Price</dt>
                <dd className="font-bold text-brand-600">GHS {cartTotal.toFixed(2)}</dd>
              </div>
            </dl>
            {hasEstimatedItems && (
              <p className="text-xs text-slate-400">
                Some items have a price range — the total shown uses the lower estimate; we'll confirm the exact price when you drop off.
              </p>
            )}
            {notes && (
              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Special Instructions</p>
                <p className="mt-1 text-sm text-slate-600">{notes}</p>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 rounded-lg bg-brand-50 p-4 text-sm text-brand-700 sm:flex-row sm:items-center sm:gap-6">
              <span className="flex items-center gap-2 font-semibold">
                <MapPin size={15} /> {selectedBranch ? `${selectedBranch.name}${selectedBranch.address ? ` — ${selectedBranch.address}` : ''}` : SHOP_ADDRESS}
              </span>
              <span className="flex items-center gap-2 font-semibold">
                <Clock size={15} /> {SHOP_HOURS}
              </span>
            </div>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          </motion.div>
        )}
        </AnimatePresence>

        <div className="mt-8 flex justify-between">
          <motion.button
            type="button"
            whileHover={{ scale: step === 0 ? 1 : 1.02 }}
            whileTap={{ scale: step === 0 ? 1 : 0.98 }}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Back
          </motion.button>

          {step < 2 ? (
            <motion.button
              type="button"
              whileHover={{ scale: canGoNext ? 1.02 : 1 }}
              whileTap={{ scale: canGoNext ? 0.98 : 1 }}
              onClick={() => setStep((s) => Math.min(2, s + 1))}
              disabled={!canGoNext}
              className="flex items-center gap-1 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
            >
              Next <ChevronRight size={16} />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              whileHover={{ scale: submitting ? 1 : 1.03 }}
              whileTap={{ scale: submitting ? 1 : 0.97 }}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Confirm Order
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
