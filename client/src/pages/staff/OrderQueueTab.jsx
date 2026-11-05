import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  PackagePlus,
  Plus,
  Printer,
  Tag,
  Wallet,
} from 'lucide-react';
import api from '../../api/axios';
import { useBranch } from '../../context/BranchContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import PaymentStatusPill from '../../components/PaymentStatusPill.jsx';
import { getAllowedTransitions, STATUS_LABELS, STORAGE_LOCATIONS } from '../../lib/orderLifecycle';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  suggestPaymentType,
} from '../../lib/payments';
import { NewDropOffModal } from './NewDropOffModal.jsx';

export function OrderQueueTab({ user }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentBranchId } = useBranch();
  const [orders, setOrders] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notesDraft, setNotesDraft] = useState({});
  const [pickupDraft, setPickupDraft] = useState({});
  const [pickupBusyId, setPickupBusyId] = useState(null);
  const [pickupSavedId, setPickupSavedId] = useState(null);
  const [storageBusyId, setStorageBusyId] = useState(null);
  const [garmentsByOrder, setGarmentsByOrder] = useState({});
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [showNewDropOff, setShowNewDropOff] = useState(false);
  const [paymentsByOrder, setPaymentsByOrder] = useState({});
  const [expandedPayments, setExpandedPayments] = useState(null);
  const [paymentForm, setPaymentForm] = useState({});
  const [paymentBusyId, setPaymentBusyId] = useState(null);
  const [paymentLinkBusyId, setPaymentLinkBusyId] = useState(null);
  const [paymentLinkResult, setPaymentLinkResult] = useState(null); // { orderId, url }
  const [invoiceBusyId, setInvoiceBusyId] = useState(null);

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, currentBranchId]);

  function loadOrders() {
    setLoading(true);
    setError('');
    return api
      .get('/orders', { params: { status: statusFilter || undefined, branch_id: currentBranchId || undefined } })
      .then(({ data }) => setOrders(data.orders))
      .catch(() => setError('Unable to load orders.'))
      .finally(() => setLoading(false));
  }

  async function advance(orderId, currentStatus, nextStatus, assignToMe) {
    setBusyId(orderId);
    setError('');
    try {
      await api.patch(`/admin/orders/${orderId}`, {
        status: nextStatus,
        notes: notesDraft[orderId] || undefined,
        assign_to_me: assignToMe || undefined,
      });
      setNotesDraft((d) => ({ ...d, [orderId]: '' }));
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update that order.');
    } finally {
      setBusyId(null);
    }
  }

  async function assignPickupDate(orderId) {
    const order = orders.find((o) => o.id === orderId);
    const date = pickupDraft[orderId] ?? order?.pickup_date?.slice(0, 10);
    if (!date) return;
    setPickupBusyId(orderId);
    setPickupSavedId(null);
    setError('');
    try {
      await api.patch(`/admin/orders/${orderId}/pickup-date`, { pickup_date: date });
      await loadOrders();
      setPickupDraft((d) => {
        const next = { ...d };
        delete next[orderId];
        return next;
      });
      setPickupSavedId(orderId);
      setTimeout(() => setPickupSavedId((id) => (id === orderId ? null : id)), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to set the pickup date.');
    } finally {
      setPickupBusyId(null);
    }
  }

  async function assignStorageLocation(orderId, location) {
    setStorageBusyId(orderId);
    setError('');
    try {
      await api.patch(`/admin/orders/${orderId}/storage-location`, { storage_location: location });
      await loadOrders();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to set the storage location.');
    } finally {
      setStorageBusyId(null);
    }
  }

  async function toggleGarments(orderId) {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    setExpandedOrder(orderId);
    if (!garmentsByOrder[orderId]) {
      try {
        const { data } = await api.get(`/orders/${orderId}/garments`);
        setGarmentsByOrder((g) => ({ ...g, [orderId]: data.garments }));
      } catch {
        setGarmentsByOrder((g) => ({ ...g, [orderId]: [] }));
      }
    }
  }

  async function addGarment(orderId, description) {
    try {
      const { data } = await api.post(`/orders/${orderId}/garments`, { description });
      setGarmentsByOrder((g) => ({ ...g, [orderId]: [...(g[orderId] || []), data.garment] }));
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to add garment tag.');
    }
  }

  async function togglePayments(orderId) {
    if (expandedPayments === orderId) {
      setExpandedPayments(null);
      return;
    }
    setExpandedPayments(orderId);
    if (!paymentsByOrder[orderId]) {
      try {
        const { data } = await api.get(`/orders/${orderId}/payments`);
        setPaymentsByOrder((p) => ({ ...p, [orderId]: data.payments }));
      } catch {
        setPaymentsByOrder((p) => ({ ...p, [orderId]: [] }));
      }
    }
  }

  function paymentDraftFor(order) {
    return (
      paymentForm[order.id] || {
        amount: '',
        payment_method: 'cash',
        payment_type: suggestPaymentType(order.balance_due, order.balance_due, order.amount_paid),
      }
    );
  }

  async function submitPayment(order) {
    const draft = paymentDraftFor(order);
    if (!draft.amount || Number(draft.amount) <= 0) return;
    setPaymentBusyId(order.id);
    setError('');
    try {
      await api.post(`/admin/orders/${order.id}/payments`, {
        amount: draft.amount,
        payment_method: draft.payment_method,
        payment_type: draft.payment_type,
        reference: draft.reference || undefined,
        notes: draft.notes || undefined,
      });
      setPaymentForm((f) => ({ ...f, [order.id]: undefined }));
      setPaymentsByOrder((p) => ({ ...p, [order.id]: undefined }));
      loadOrders();
      if (expandedPayments === order.id) {
        const { data } = await api.get(`/orders/${order.id}/payments`);
        setPaymentsByOrder((p) => ({ ...p, [order.id]: data.payments }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to record that payment.');
    } finally {
      setPaymentBusyId(null);
    }
  }

  // Staff initiating a Paystack charge on the customer's behalf — e.g. to
  // send/show a payment link instead of taking cash. Unlike submitPayment,
  // nothing is recorded in `payments` here; that only happens once Paystack
  // confirms the charge, via the same verify/webhook flow the customer's own
  // "Pay Now" button uses.
  async function getPaymentLink(order) {
    const draft = paymentDraftFor(order);
    const amount = Number(draft.amount) || Number(order.balance_due);
    if (!(amount > 0)) return;
    setPaymentLinkBusyId(order.id);
    setPaymentLinkResult(null);
    setError('');
    try {
      const { data } = await api.post('/paystack/initialize', {
        order_id: order.id,
        amount,
        payment_type: draft.payment_type,
      });
      setPaymentLinkResult({ orderId: order.id, url: data.authorization_url });
      navigator.clipboard?.writeText(data.authorization_url).catch(() => {});
      window.open(data.authorization_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create a payment link.');
    } finally {
      setPaymentLinkBusyId(null);
    }
  }

  // Opens the order's active invoice, generating one first if it doesn't
  // have one yet — the lazy generate-on-first-open pattern mirrors how
  // togglePayments/toggleGarments already fetch on demand rather than
  // loading invoice state for every row up front.
  async function viewOrGenerateInvoice(orderId) {
    setInvoiceBusyId(orderId);
    setError('');
    try {
      let invoiceId;
      try {
        const { data } = await api.get(`/orders/${orderId}/invoice`);
        invoiceId = data.invoice.id;
      } catch (err) {
        if (err.response?.status === 404) {
          const { data } = await api.post(`/admin/orders/${orderId}/invoice`);
          invoiceId = data.invoice.id;
        } else {
          throw err;
        }
      }
      navigate(`/invoices/${invoiceId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to open the invoice.');
    } finally {
      setInvoiceBusyId(null);
    }
  }

  function toggleSelect(orderId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  // Generates an invoice for every selected order in one action — Hubtel's
  // "Many Invoices" bulk-create, scoped to orders the staff member already
  // has open rather than a recurring/subscription billing engine (this
  // business has no subscription model to build one against).
  async function generateInvoicesForSelected() {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setError('');
    try {
      const { data } = await api.post('/admin/invoices/bulk', { order_ids: Array.from(selectedIds) });
      toast.success(`${data.created.length} invoice(s) generated${data.skipped.length ? `, ${data.skipped.length} skipped` : ''}.`);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to generate invoices for the selected orders.');
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {selectedIds.size > 0 && (
          <button
            onClick={generateInvoicesForSelected}
            disabled={bulkBusy}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            <FileText size={15} /> {bulkBusy ? 'Generating...' : `Generate ${selectedIds.size} Invoice(s)`}
          </button>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm outline-none transition-colors focus:border-brand-400"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button onClick={loadOrders} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Refresh
        </button>
        <button
          onClick={() => setShowNewDropOff(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          <PackagePlus size={15} /> New Drop-off
        </button>
      </div>

      {showNewDropOff && (
        <NewDropOffModal
          onClose={() => setShowNewDropOff(false)}
          onCreated={() => {
            setShowNewDropOff(false);
            loadOrders();
          }}
        />
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500">Loading orders...</p>}
      {!loading && orders.length === 0 && <p className="mt-4 text-sm text-slate-500">No orders match this filter.</p>}

      <div className="mt-4 space-y-4">
        {orders.map((order) => {
          const nextOptions = getAllowedTransitions(order.status, user.role);
          const garments = garmentsByOrder[order.id];

          return (
            <div key={order.id} className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(order.id)}
                    onChange={() => toggleSelect(order.id)}
                    title="Select for bulk invoice generation"
                    className="mt-1 h-4 w-4 accent-brand-500"
                  />
                  <div>
                    <p className="font-semibold text-ink-900 dark:text-white">
                      #{order.id} · {order.items_summary || `${order.item_count} item(s)`} — {order.customer_name}
                    </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {order.customer_phone} · {order.branch_name} · Drop-off {order.drop_off_date?.slice(0, 10)}
                    {order.pickup_date && <> · Pickup {order.pickup_date.slice(0, 10)}</>}
                  </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={order.status} />
                  <span className="font-semibold text-brand-600">GHS {Number(order.total_price).toFixed(2)}</span>
                  <Link
                    to={`/orders/${order.id}/receipt`}
                    className="text-slate-400 transition hover:text-brand-600"
                    title="Print Receipt"
                  >
                    <Printer size={16} />
                  </Link>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <PaymentStatusPill status={order.payment_status} />
                {order.balance_due > 0 && (
                  <span className="text-xs font-semibold text-slate-500">
                    Balance due: GHS {Number(order.balance_due).toFixed(2)}
                  </span>
                )}
                {order.discount_amount > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    🎂 Birthday discount: −GHS {Number(order.discount_amount).toFixed(2)}
                  </span>
                )}
                {order.storage_location && (
                  <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    <MapPin size={13} /> Stored at: {order.storage_location}
                  </span>
                )}
              </div>

              {order.late_fee > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-700"
                >
                  <AlertTriangle size={14} /> {order.days_overdue} day{order.days_overdue === 1 ? '' : 's'} overdue —
                  GHS {order.late_fee.toFixed(2)} storage fee accrued
                  {order.late_fee_paid > 0 && ` (GHS ${order.late_fee_due.toFixed(2)} still due)`}
                </motion.div>
              )}

              {order.notes && <p className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm text-slate-600 dark:text-slate-300">Note: {order.notes}</p>}

              {!['completed', 'cancelled'].includes(order.status) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-3">
                  <CalendarDays size={15} className="text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500">
                    {order.pickup_date ? 'Update pickup date:' : 'Assign a pickup date:'}
                  </span>
                  <input
                    type="date"
                    min={order.drop_off_date?.slice(0, 10)}
                    value={pickupDraft[order.id] ?? order.pickup_date?.slice(0, 10) ?? ''}
                    onChange={(e) => {
                      setPickupSavedId((id) => (id === order.id ? null : id));
                      setPickupDraft((d) => ({ ...d, [order.id]: e.target.value }));
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-xs outline-none transition-colors focus:border-brand-400"
                  />
                  <button
                    onClick={() => assignPickupDate(order.id)}
                    disabled={pickupBusyId === order.id || !(pickupDraft[order.id] ?? order.pickup_date?.slice(0, 10))}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {pickupBusyId === order.id ? 'Saving...' : 'Save'}
                  </button>
                  {pickupSavedId === order.id && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                      <CheckCircle2 size={14} /> Saved — pickup set for {order.pickup_date?.slice(0, 10)}
                    </motion.span>
                  )}
                </div>
              )}

              {order.status === 'ready_for_pickup' && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-3">
                  <MapPin size={15} className="text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500">
                    {order.storage_location ? 'Move to:' : 'Place in storage:'}
                  </span>
                  {STORAGE_LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      disabled={storageBusyId === order.id || order.storage_location === loc}
                      onClick={() => assignStorageLocation(order.id, loc)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${
                        order.storage_location === loc
                          ? 'bg-indigo-500 text-white'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                  {storageBusyId === order.id && <Loader2 size={14} className="animate-spin text-slate-400" />}
                  <button
                    onClick={() => window.open(`/orders/${order.id}/tag`, '_blank', 'noopener,noreferrer')}
                    title="Print a shelf tag with this customer's name, phone, and storage location"
                    className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600"
                  >
                    <Printer size={13} /> Print Tag
                  </button>
                </div>
              )}

              {nextOptions.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    value={notesDraft[order.id] || ''}
                    onChange={(e) => setNotesDraft((d) => ({ ...d, [order.id]: e.target.value }))}
                    placeholder="Add a note (optional)"
                    className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400"
                  />
                  {nextOptions.map((next) => (
                    <button
                      key={next}
                      disabled={busyId === order.id}
                      onClick={() => advance(order.id, order.status, next, !order.assigned_staff_id)}
                      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition disabled:opacity-50 ${
                        next === 'cancelled' ? 'bg-slate-500 hover:bg-slate-600' : 'bg-brand-500 hover:bg-brand-600'
                      }`}
                    >
                      {busyId === order.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      {STATUS_LABELS[next] || next}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-400">No further action available.</p>
              )}

              <div className="mt-4 flex flex-wrap gap-4">
                <button
                  onClick={() => toggleGarments(order.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-brand-600"
                >
                  <Tag size={13} /> {expandedOrder === order.id ? 'Hide' : 'Show'} garment tags
                </button>
                <button
                  onClick={() => togglePayments(order.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-brand-600"
                >
                  <Wallet size={13} /> {expandedPayments === order.id ? 'Hide' : 'Show'} payments
                </button>
              </div>

              {expandedPayments === order.id && (
                <div className="mt-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                  {(paymentsByOrder[order.id] || []).length === 0 && (
                    <p className="text-xs text-slate-400">No payments recorded yet.</p>
                  )}
                  <ul className="space-y-1">
                    {(paymentsByOrder[order.id] || []).map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>
                          {new Date(p.paid_at).toLocaleDateString()} — {PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}
                          {' '}({PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method})
                          {p.recorded_by_name && <span className="text-slate-400"> · by {p.recorded_by_name}</span>}
                        </span>
                        <span className={`font-semibold ${p.payment_type === 'refund' ? 'text-red-600' : 'text-green-600'}`}>
                          {p.payment_type === 'refund' ? '-' : '+'}GHS {Number(p.amount).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {!['cancelled'].includes(order.status) && (
                    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                      <div>
                        <label htmlFor={`payment-amount-${order.id}`} className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Amount</label>
                        <input
                          id={`payment-amount-${order.id}`}
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={paymentDraftFor(order).amount}
                          onChange={(e) =>
                            setPaymentForm((f) => ({ ...f, [order.id]: { ...paymentDraftFor(order), amount: e.target.value } }))
                          }
                          className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-400"
                        />
                      </div>
                      <div>
                        <label htmlFor={`payment-method-${order.id}`} className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Method</label>
                        <select
                          id={`payment-method-${order.id}`}
                          value={paymentDraftFor(order).payment_method}
                          onChange={(e) =>
                            setPaymentForm((f) => ({ ...f, [order.id]: { ...paymentDraftFor(order), payment_method: e.target.value } }))
                          }
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none focus:border-brand-400"
                        >
                          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="staff-type" className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Type</label>
                        <select id="staff-type"
                          value={paymentDraftFor(order).payment_type}
                          onChange={(e) =>
                            setPaymentForm((f) => ({ ...f, [order.id]: { ...paymentDraftFor(order), payment_type: e.target.value } }))
                          }
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none focus:border-brand-400"
                        >
                          {PAYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <button
                        onClick={() => submitPayment(order)}
                        disabled={paymentBusyId === order.id || !paymentDraftFor(order).amount}
                        className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                      >
                        {paymentBusyId === order.id ? 'Saving...' : 'Record Payment'}
                      </button>
                      <button
                        onClick={() => getPaymentLink(order)}
                        disabled={paymentLinkBusyId === order.id}
                        title="Create a Paystack payment link the customer can pay with online"
                        className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
                      >
                        {paymentLinkBusyId === order.id ? 'Creating link...' : 'Get Payment Link'}
                      </button>
                      {paymentLinkResult?.orderId === order.id && (
                        <p className="w-full text-xs text-emerald-600">
                          Link opened in a new tab and copied to your clipboard — send it to the customer.
                        </p>
                      )}
                      <button
                        onClick={() => viewOrGenerateInvoice(order.id)}
                        disabled={invoiceBusyId === order.id}
                        title="View or generate this order's invoice"
                        className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <FileText size={13} /> {invoiceBusyId === order.id ? 'Opening...' : 'Invoice'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {expandedOrder === order.id && (
                <div className="mt-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                  {(garments || []).length === 0 && <p className="text-xs text-slate-400">No garment tags yet.</p>}
                  <ul className="space-y-1">
                    {(garments || []).map((g) => (
                      <li key={g.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>{g.tag_code} — {g.description || 'Untitled item'}</span>
                        <span className="text-slate-400">{g.status}</span>
                      </li>
                    ))}
                  </ul>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.target.elements.description;
                      if (input.value.trim()) {
                        addGarment(order.id, input.value.trim());
                        input.value = '';
                      }
                    }}
                    className="mt-3 flex gap-2"
                  >
                    <input
                      name="description"
                      placeholder="e.g. Blue cotton shirt"
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs outline-none transition-colors focus:border-brand-400"
                    />
                    <button type="submit" className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
                      <Plus size={13} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
