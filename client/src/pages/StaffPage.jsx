import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  BookUser,
  Boxes,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Minus,
  PackagePlus,
  Percent,
  Plus,
  Printer,
  Receipt,
  Search,
  Tag,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useBranch } from '../context/BranchContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import StatusPill from '../components/StatusPill.jsx';
import PaymentStatusPill from '../components/PaymentStatusPill.jsx';
import InvoiceStatusPill from '../components/InvoiceStatusPill.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import { getAllowedTransitions, STATUS_LABELS, STORAGE_LOCATIONS } from '../lib/orderLifecycle';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_TYPES, PAYMENT_TYPE_LABELS, suggestPaymentType } from '../lib/payments';
import { INVOICE_STATUS_LABELS } from '../lib/invoices';

const ADMIN_ROLES = ['administrator', 'super_admin'];

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

const TABS = [
  { key: 'orders', label: 'Order Queue', icon: ClipboardList, adminOnly: false },
  { key: 'customers', label: 'Customers', icon: BookUser, adminOnly: false },
  { key: 'messages', label: 'Messages', icon: Mail, adminOnly: false },
  { key: 'pickups', label: 'Scheduled Pickups', icon: CalendarCheck, adminOnly: true },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
  { key: 'payments', label: 'Payments', icon: Wallet, adminOnly: true },
  { key: 'invoices', label: 'Invoices', icon: FileText, adminOnly: false },
  { key: 'inventory', label: 'Inventory', icon: Boxes, adminOnly: true },
  { key: 'expenses', label: 'Expenses', icon: Receipt, adminOnly: true },
  { key: 'staff', label: 'Staff', icon: Users, adminOnly: true },
  { key: 'branches', label: 'Branches', icon: Building2, adminOnly: true, superAdminOnly: true },
  { key: 'zones', label: 'Zones', icon: MapPin, adminOnly: true },
  { key: 'pricing', label: 'Pricing', icon: Percent, adminOnly: true },
  { key: 'capacity', label: 'Capacity', icon: CalendarDays, adminOnly: true },
];

export default function StaffPage() {
  const { user } = useAuth();
  const { branches, currentBranchId, setCurrentBranchId, isSuperAdmin } = useBranch();
  const isAdmin = ADMIN_ROLES.includes(user.role);
  const [tab, setTab] = useState('orders');

  const visibleTabs = TABS.filter((t) => (!t.adminOnly || isAdmin) && (!t.superAdminOnly || isSuperAdmin));

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16 pt-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-900 dark:text-white">Staff Dashboard</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Signed in as {user.full_name} · {STAFF_ROLE_LABELS[user.role] || user.role}</p>
        </div>
        {isSuperAdmin && branches.length > 0 && (
          <select
            value={currentBranchId}
            onChange={(e) => setCurrentBranchId(e.target.value)}
            title="Filter the Order Queue, Invoices, Payments, and Analytics tabs by branch"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-6 md:flex-row md:gap-10">
        <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible md:border-r md:border-slate-200 md:pr-4 md:dark:border-slate-700">
          {visibleTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm font-semibold transition md:w-full ${
                tab === key
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {tab === 'orders' && <OrderQueueTab user={user} />}
              {tab === 'customers' && <CustomersTab />}
              {tab === 'messages' && <MessagesTab isAdmin={isAdmin} />}
              {tab === 'pickups' && isAdmin && <ScheduledPickupsTab />}
              {tab === 'analytics' && isAdmin && <AnalyticsTab />}
              {tab === 'payments' && isAdmin && <PaymentsTab />}
              {tab === 'invoices' && <InvoicesTab />}
              {tab === 'inventory' && isAdmin && <InventoryTab />}
              {tab === 'expenses' && isAdmin && <ExpensesTab />}
              {tab === 'staff' && isAdmin && <StaffTab user={user} />}
              {tab === 'branches' && isSuperAdmin && <BranchesTab />}
              {tab === 'zones' && isAdmin && <ZonesTab />}
              {tab === 'pricing' && isAdmin && <PricingTab />}
              {tab === 'capacity' && isAdmin && <CapacityTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const STAFF_ROLE_LABELS = {
  laundry_staff: 'Laundry Staff',
  administrator: 'Administrator',
  super_admin: 'Super Admin',
};

function CustomersTab() {
  const { formatPrice } = useCurrency();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [detailById, setDetailById] = useState({});
  const [detailLoading, setDetailLoading] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(loadCustomers, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  function loadCustomers() {
    setLoading(true);
    setError('');
    api
      .get('/admin/customers', { params: search ? { search } : {} })
      .then(({ data }) => setCustomers(data.customers))
      .catch(() => setError('Unable to load customers.'))
      .finally(() => setLoading(false));
  }

  async function toggleCustomer(id) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detailById[id]) {
      setDetailLoading(id);
      try {
        const { data } = await api.get(`/admin/customers/${id}`);
        setDetailById((d) => ({ ...d, [id]: data }));
      } catch {
        setError('Unable to load that customer\'s order history.');
      } finally {
        setDetailLoading(null);
      }
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Customers ({customers.length})</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or username..."
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading customers...</p>}
      {!loading && customers.length === 0 && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No customers found.</p>}

      <div className="mt-4 space-y-3">
        {customers.map((c) => {
          const isOpen = expandedId === c.id;
          const detail = detailById[c.id];
          return (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
              <button
                onClick={() => toggleCustomer(c.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left"
              >
                <div>
                  <p className="font-semibold text-ink-900 dark:text-white">{c.full_name} <span className="font-normal text-slate-400">@{c.username}</span></p>
                  <p className="mt-1 text-xs text-slate-400">
                    {c.email} · {c.phone_number} · {c.location_zone}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>{c.order_count} order{c.order_count === '1' ? '' : 's'}</span>
                  {Number(c.pending_pickup_count) > 0 && (
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-600 dark:bg-brand-900/30">
                      {c.pending_pickup_count} awaiting pickup
                    </span>
                  )}
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/40">
                  {detailLoading === c.id && <p className="text-sm text-slate-500 dark:text-slate-400">Loading order history...</p>}
                  {detail && detail.orders.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No orders yet.</p>
                  )}
                  {detail && detail.orders.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="px-3 py-2 font-medium">Items</th>
                            <th className="px-3 py-2 font-medium">Drop-off</th>
                            <th className="px-3 py-2 font-medium">Pickup Date</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                            <th className="px-3 py-2 font-medium">Picked Up?</th>
                            <th className="px-3 py-2 text-right font-medium">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {detail.orders.map((o) => (
                            <tr key={o.id}>
                              <td className="px-3 py-2.5 font-medium text-ink-900 dark:text-white">
                                {o.items_summary || `${o.item_count} item(s)`}
                              </td>
                              <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{o.drop_off_date?.slice(0, 10)}</td>
                              <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{o.pickup_date?.slice(0, 10) || '—'}</td>
                              <td className="px-3 py-2.5"><StatusPill status={o.status} /></td>
                              <td className="px-3 py-2.5">
                                {o.picked_up ? (
                                  <span className="flex items-center gap-1 font-semibold text-green-600"><CheckCircle2 size={14} /> Yes</span>
                                ) : (
                                  <span className="text-slate-400">No</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-brand-600">{formatPrice(o.total_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScheduledPickupsTab() {
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  function loadOrders() {
    setLoading(true);
    setError('');
    api
      .get('/orders')
      .then(({ data }) => setOrders(data.orders))
      .catch(() => setError('Unable to load scheduled pickups.'))
      .finally(() => setLoading(false));
  }

  const scheduled = useMemo(
    () =>
      orders
        .filter((o) => o.pickup_date && !['completed', 'cancelled'].includes(o.status))
        .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date)),
    [orders]
  );

  const groups = useMemo(() => {
    const map = new Map();
    for (const order of scheduled) {
      const date = order.pickup_date.slice(0, 10);
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(order);
    }
    return Array.from(map.entries());
  }, [scheduled]);

  const today = todayISO();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  function dateLabel(dateStr) {
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink-900 dark:text-white">
          Scheduled Pickups ({scheduled.length})
        </h2>
        <button onClick={loadOrders} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Refresh
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading scheduled pickups...</p>}
      {!loading && groups.length === 0 && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No orders currently have a pickup date assigned.</p>
      )}

      <div className="mt-6 space-y-8">
        {groups.map(([date, dateOrders]) => {
          const isOverdue = date < today;
          return (
            <div key={date}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`text-sm font-bold uppercase tracking-widest ${isOverdue ? 'text-red-600' : 'text-brand-600'}`}>
                  {dateLabel(date)}
                </h3>
                <span className="text-xs font-semibold text-slate-400">{date}</span>
                <span className="text-xs font-semibold text-slate-400">
                  · {dateOrders.length} order{dateOrders.length === 1 ? '' : 's'}
                </span>
                {isOverdue && (
                  <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    <AlertTriangle size={11} /> Overdue
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-3">
                {dateOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div>
                      <p className="font-semibold text-ink-900 dark:text-white">
                        #{order.id} · {order.items_summary || `${order.item_count} item(s)`} — {order.customer_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {order.customer_phone} · Drop-off {order.drop_off_date?.slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusPill status={order.status} />
                      <PaymentStatusPill status={order.payment_status} />
                      <span className="font-semibold text-brand-600">{formatPrice(order.total_price)}</span>
                      <Link
                        to={`/orders/${order.id}/receipt`}
                        className="text-slate-400 transition hover:text-brand-600"
                        title="Print Receipt"
                      >
                        <Printer size={16} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderQueueTab({ user }) {
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
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-colors focus:border-brand-400"
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
            <div key={order.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft">
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
                    <p className="font-semibold text-ink-900">
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
                  className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                >
                  <AlertTriangle size={14} /> {order.days_overdue} day{order.days_overdue === 1 ? '' : 's'} overdue —
                  GHS {order.late_fee.toFixed(2)} storage fee accrued
                </motion.div>
              )}

              {order.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Note: {order.notes}</p>}

              {!['completed', 'cancelled'].includes(order.status) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-200 p-3">
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
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none transition-colors focus:border-brand-400"
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
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-200 p-3">
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
                          : 'border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                  {storageBusyId === order.id && <Loader2 size={14} className="animate-spin text-slate-400" />}
                  <button
                    onClick={() => window.open(`/orders/${order.id}/tag`, '_blank', 'noopener,noreferrer')}
                    title="Print a shelf tag with this customer's name, phone, and storage location"
                    className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
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
                    className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400"
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
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  {(paymentsByOrder[order.id] || []).length === 0 && (
                    <p className="text-xs text-slate-400">No payments recorded yet.</p>
                  )}
                  <ul className="space-y-1">
                    {(paymentsByOrder[order.id] || []).map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-xs text-slate-600">
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
                    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={paymentDraftFor(order).amount}
                          onChange={(e) =>
                            setPaymentForm((f) => ({ ...f, [order.id]: { ...paymentDraftFor(order), amount: e.target.value } }))
                          }
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Method</label>
                        <select
                          value={paymentDraftFor(order).payment_method}
                          onChange={(e) =>
                            setPaymentForm((f) => ({ ...f, [order.id]: { ...paymentDraftFor(order), payment_method: e.target.value } }))
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-400"
                        >
                          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">Type</label>
                        <select
                          value={paymentDraftFor(order).payment_type}
                          onChange={(e) =>
                            setPaymentForm((f) => ({ ...f, [order.id]: { ...paymentDraftFor(order), payment_type: e.target.value } }))
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-400"
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
                        className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <FileText size={13} /> {invoiceBusyId === order.id ? 'Opening...' : 'Invoice'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {expandedOrder === order.id && (
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  {(garments || []).length === 0 && <p className="text-xs text-slate-400">No garment tags yet.</p>}
                  <ul className="space-y-1">
                    {(garments || []).map((g) => (
                      <li key={g.id} className="flex items-center justify-between text-xs text-slate-600">
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
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none transition-colors focus:border-brand-400"
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

// Lets staff record a walk-in drop-off directly — for an existing customer
// found by search, or a brand-new one entered on the spot. The customer
// doesn't have to be the one physically present (dropped_off_by notes who
// actually brought the items in, e.g. a friend or family member).
function NewDropOffModal({ onClose, onCreated }) {
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
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Drop-off date</label>
              <input
                type="date"
                value={dropOffDate}
                onChange={(e) => setDropOffDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Pickup date (optional)</label>
              <input
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

function StaffTab() {
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
        <h2 className="font-display text-lg text-ink-900">Staff Accounts</h2>
        {loading && <p className="mt-3 text-sm text-slate-500">Loading...</p>}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Zone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{s.full_name}</p>
                      <p className="text-xs text-slate-400">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{STAFF_ROLE_LABELS[s.role] || s.role}</td>
                    <td className="px-4 py-3 text-slate-600">{s.branch_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.location_zone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg text-ink-900">Add Staff</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
          <input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
          <input required placeholder="Phone number" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
          <input required placeholder="Location zone" value={form.location_zone} onChange={(e) => setForm({ ...form, location_zone: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400">
            <option value="laundry_staff">Laundry Staff</option>
            <option value="administrator">Administrator</option>
          </select>
          {isSuperAdmin && (
            <select required value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400">
              <option value="">Assign to branch...</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input required type="password" minLength={8} placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {submitting && <Loader2 size={14} className="animate-spin" />} Create Account
          </button>
        </form>
      </div>
    </div>
  );
}

function ZonesTab() {
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
      <h2 className="font-display text-lg text-ink-900">Customer Areas</h2>
      <p className="mt-1 text-sm text-slate-500">
        Informational only — the towns customers register from. Doesn't affect drop-off since customers bring
        laundry in themselves.
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={addZone} className="mt-4 flex max-w-md gap-2">
        <input value={newZone} onChange={(e) => setNewZone(e.target.value)} placeholder="New area name" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
        <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Add</button>
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {zones.map((z) => (
                <tr key={z.id}>
                  <td className="px-4 py-3 font-medium text-ink-900">{z.zone_name}</td>
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

function BranchesTab() {
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
            <table className="w-full text-left text-sm">
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

function PricingTab() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [newItem, setNewItem] = useState({ category: '', item_name: '', unit_price: '' });

  useEffect(() => {
    loadItems();
  }, []);

  function loadItems() {
    api.get('/admin/items').then(({ data }) => setItems(data.items)).catch(() => setError('Unable to load the price list.'));
  }

  function draftFor(item) {
    if (drafts[item.id]) return drafts[item.id];
    return item.unit_price != null
      ? { mode: 'fixed', unit_price: item.unit_price, price_min: '', price_max: '' }
      : { mode: 'range', unit_price: '', price_min: item.price_min, price_max: item.price_max };
  }

  function updateDraft(id, item, patch) {
    setDrafts((d) => ({ ...d, [id]: { ...draftFor(item), ...patch } }));
  }

  async function saveItem(item) {
    const draft = draftFor(item);
    setSavingId(item.id);
    setError('');
    try {
      const payload =
        draft.mode === 'fixed'
          ? { unit_price: draft.unit_price }
          : { price_min: draft.price_min, price_max: draft.price_max };
      await api.patch(`/admin/items/${item.id}`, payload);
      loadItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update that price.');
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(item) {
    try {
      await api.patch(`/admin/items/${item.id}`, { is_active: !item.is_active });
      loadItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update that item.');
    }
  }

  async function addItem(e) {
    e.preventDefault();
    if (!newItem.category.trim() || !newItem.item_name.trim() || !newItem.unit_price) return;
    try {
      await api.post('/admin/items', { ...newItem, unit_price: Number(newItem.unit_price) });
      setNewItem({ category: '', item_name: '', unit_price: '' });
      loadItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to add that item.');
    }
  }

  const grouped = items
    .filter((i) => i.item_name.toLowerCase().includes(search.toLowerCase()))
    .reduce((groups, item) => {
      groups[item.category] = groups[item.category] || [];
      groups[item.category].push(item);
      return groups;
    }, {});

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink-900">Price List ({items.length} items)</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400"
        />
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={addItem} className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-slate-200 p-4">
        <input required placeholder="Category" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
        <input required placeholder="Item name" value={newItem.item_name} onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
        <input required type="number" step="0.01" placeholder="Price (GHS)" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
        <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Add Item</button>
      </form>

      <div className="mt-6 space-y-8">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand-600">{category}</h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {categoryItems.map((item) => {
                    const draft = draftFor(item);
                    return (
                      <tr key={item.id} className={item.is_active ? '' : 'opacity-50'}>
                        <td className="px-4 py-2.5 font-medium text-ink-900">{item.item_name}</td>
                        <td className="px-4 py-2.5">
                          <select
                            value={draft.mode}
                            onChange={(e) => updateDraft(item.id, item, { mode: e.target.value })}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none transition-colors focus:border-brand-400"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="range">Range</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          {draft.mode === 'fixed' ? (
                            <input
                              type="number"
                              step="0.01"
                              value={draft.unit_price}
                              onChange={(e) => updateDraft(item.id, item, { unit_price: e.target.value })}
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none transition-colors focus:border-brand-400"
                            />
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Min"
                                value={draft.price_min}
                                onChange={(e) => updateDraft(item.id, item, { price_min: e.target.value })}
                                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none transition-colors focus:border-brand-400"
                              />
                              <span className="text-slate-400">–</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Max"
                                value={draft.price_max}
                                onChange={(e) => updateDraft(item.id, item, { price_max: e.target.value })}
                                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none transition-colors focus:border-brand-400"
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => saveItem(item)}
                            disabled={savingId === item.id}
                            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                          >
                            Save
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => toggleActive(item)}
                            className="text-xs font-semibold text-slate-400 hover:text-brand-600"
                          >
                            {item.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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

function CapacityTab() {
  const [capacity, setCapacity] = useState([]);
  const [form, setForm] = useState({ date: '', max_orders: 50 });
  const [error, setError] = useState('');

  useEffect(() => {
    loadCapacity();
  }, []);

  function loadCapacity() {
    api.get('/admin/capacity').then(({ data }) => setCapacity(data.capacity)).catch(() => setError('Unable to load capacity.'));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date) return;
    try {
      await api.post('/admin/capacity', form);
      setForm({ date: '', max_orders: 50 });
      loadCapacity();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to set capacity.');
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg text-ink-900">Daily Order Capacity</h2>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Date</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Max Orders</label>
          <input type="number" min="1" value={form.max_orders} onChange={(e) => setForm({ ...form, max_orders: e.target.value })} className="mt-1 w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400" />
        </div>
        <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Set</button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Max Orders</th>
                <th className="px-4 py-3 font-medium">Current Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {capacity.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-ink-900">{c.capacity_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600">{c.max_orders}</td>
                  <td className="px-4 py-3 text-slate-600">{c.current_orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SendMessageForm() {
  const [target, setTarget] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    if (target !== 'single' || selectedCustomer || !customerSearch.trim()) {
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
  }, [customerSearch, target, selectedCustomer]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (target === 'single' && !selectedCustomer) {
      setError('Choose a customer to message.');
      return;
    }
    if (target === 'all' && !window.confirm('Send this message to every customer account?')) {
      return;
    }

    setSubmitting(true);
    setError('');
    setResult('');
    try {
      const { data } = await api.post('/admin/messages', {
        title: title.trim(),
        body: body.trim(),
        customer_id: target === 'single' ? selectedCustomer.id : undefined,
        send_email: sendEmail,
        send_sms: sendSms,
      });
      setResult(
        target === 'single'
          ? `Message sent to ${selectedCustomer.full_name}.`
          : `Message sent to ${data.recipient_count} customer${data.recipient_count === 1 ? '' : 's'}.`
      );
      setTitle('');
      setBody('');
      setSelectedCustomer(null);
      setCustomerSearch('');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to send that message.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800"
    >
      <h2 className="font-display text-lg text-ink-900 dark:text-white">Send a Message</h2>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setTarget('all');
            setError('');
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            target === 'all'
              ? 'border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-900/30'
              : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-300'
          }`}
        >
          All Customers
        </button>
        <button
          type="button"
          onClick={() => {
            setTarget('single');
            setError('');
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            target === 'single'
              ? 'border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-900/30'
              : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-300'
          }`}
        >
          Individual Customer
        </button>
      </div>

      {target === 'single' && (
        selectedCustomer ? (
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
        )
      )}

      <input
        required
        maxLength={255}
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
      />
      <textarea
        required
        maxLength={2000}
        rows={4}
        placeholder="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
      />

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-3.5 w-3.5 accent-brand-500" />
          Also send by email
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} className="h-3.5 w-3.5 accent-brand-500" />
          Also send by SMS
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      {result && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{result}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        {target === 'all' ? 'Send to All Customers' : 'Send Message'}
      </button>
    </form>
  );
}

function MessagesTab({ isAdmin }) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, []);

  function loadMessages() {
    setLoading(true);
    api
      .get('/contact')
      .then(({ data }) => setMessages(data.messages))
      .catch(() => setError('Unable to load messages.'))
      .finally(() => setLoading(false));
  }

  async function markRead(id) {
    try {
      await api.patch(`/contact/${id}/read`);
      loadMessages();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to mark that message read.');
    }
  }

  return (
    <div>
      {isAdmin && <SendMessageForm />}

      <h2 className={`font-display text-lg text-ink-900 dark:text-white ${isAdmin ? 'mt-10' : ''}`}>
        Contact Messages ({messages.length})
      </h2>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading messages...</p>}
      {!loading && messages.length === 0 && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No messages yet.</p>}

      <div className="mt-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl border p-5 shadow-soft ${
              m.read_at ? 'border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800' : 'border-brand-200 bg-brand-50/40 dark:border-brand-900/50 dark:bg-brand-950/20'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink-900 dark:text-white">{m.name} <span className="font-normal text-slate-400">&lt;{m.email}&gt;</span></p>
                <p className="mt-1 text-xs text-slate-400">{new Date(m.created_at).toLocaleString()}</p>
              </div>
              {!m.read_at && (
                <button onClick={() => markRead(m.id)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Mark as read
                </button>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{m.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const SALES_PERIODS = [
  { key: 'daily_sales', label: 'Daily (30d)' },
  { key: 'monthly_sales', label: 'Monthly (12mo)' },
  { key: 'yearly_sales', label: 'Yearly' },
];

function formatPeriodLabel(periodKey, period) {
  if (periodKey === 'yearly_sales') return period;
  if (periodKey === 'monthly_sales') {
    return new Date(`${period}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  return period;
}

function AnalyticsTab() {
  const { formatPrice } = useCurrency();
  const { currentBranchId } = useBranch();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [periodKey, setPeriodKey] = useState('daily_sales');

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/analytics', { params: { branch_id: currentBranchId || undefined } })
      .then(({ data }) => setData(data))
      .catch(() => setError('Unable to load analytics.'))
      .finally(() => setLoading(false));
  }, [currentBranchId]);

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading analytics...</p>;
  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const trend = data[periodKey] || [];
  const maxRevenue = Math.max(1, ...trend.map((d) => d.revenue));

  return (
    <div>
      <h2 className="font-display text-lg text-ink-900 dark:text-white">Analytics</h2>

      {data.low_stock_count > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle size={16} /> {data.low_stock_count} inventory item{data.low_stock_count === 1 ? ' is' : 's are'} running low — check Staff → Inventory.
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Orders</p>
          <p className="mt-2 font-display text-3xl text-ink-900 dark:text-white">
            <AnimatedNumber value={data.total_orders} />
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Revenue</p>
          <p className="mt-2 font-display text-3xl text-ink-900 dark:text-white">
            <AnimatedNumber value={data.total_revenue} format={formatPrice} />
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Expenses</p>
          <p className="mt-2 font-display text-3xl text-ink-900 dark:text-white">
            <AnimatedNumber value={data.total_expenses} format={formatPrice} />
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Net Profit</p>
          <p className={`mt-2 font-display text-3xl ${data.net_profit < 0 ? 'text-red-600' : 'text-ink-900 dark:text-white'}`}>
            <AnimatedNumber value={data.net_profit} format={formatPrice} />
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Outstanding Balance</p>
          <p className={`mt-2 font-display text-3xl ${data.outstanding_balance > 0 ? 'text-amber-600' : 'text-ink-900 dark:text-white'}`}>
            <AnimatedNumber value={data.outstanding_balance} format={formatPrice} />
          </p>
        </motion.div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Sales Trend</h3>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
            {SALES_PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodKey(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  periodKey === p.key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {trend.length === 0 && <p className="mt-4 text-sm text-slate-400">Not enough data yet.</p>}

        <div className="mt-4 flex h-32 items-end gap-1">
          {trend.map((d, i) => (
            <div key={d.period} className="group relative flex-1">
              <motion.div
                className={`origin-bottom rounded-t transition-colors ${
                  d.net < 0 ? 'bg-red-400 group-hover:bg-red-500' : 'bg-brand-400 group-hover:bg-brand-500'
                }`}
                style={{ height: `${Math.max(2, (d.revenue / maxRevenue) * 100)}%` }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: Math.min(i * 0.015, 0.5) }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink-900 px-2 py-1.5 text-xs text-white group-hover:block">
                <p className="font-semibold">{formatPeriodLabel(periodKey, d.period)}</p>
                <p>Revenue: {formatPrice(d.revenue)} ({d.order_count} order{d.order_count === 1 ? '' : 's'})</p>
                {d.expenses > 0 && <p>Expenses: {formatPrice(d.expenses)}</p>}
                <p>Net: {formatPrice(d.net)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Orders by Status</h3>
          <div className="mt-4 space-y-2">
            {data.orders_by_status.map((s) => (
              <div key={s.status} className="flex items-center justify-between text-sm">
                <StatusPill status={s.status} />
                <span className="font-semibold text-slate-600 dark:text-slate-300">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Busiest Drop-off Dates</h3>
          <div className="mt-4 space-y-2">
            {data.busiest_dates.length === 0 && <p className="text-sm text-slate-400">Not enough data yet.</p>}
            {data.busiest_dates.map((b) => (
              <div key={b.drop_off_date} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{new Date(b.drop_off_date).toISOString().slice(0, 10)}</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">{b.order_count} order{b.order_count === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const NEW_INVENTORY_ITEM = { name: '', category: '', unit: 'pieces', quantity_on_hand: '', reorder_threshold: '' };

function InventoryTab() {
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

const EXPENSE_CATEGORIES = ['Utilities', 'Supplies', 'Wages', 'Rent', 'Maintenance', 'Other'];
const NEW_EXPENSE = { category: 'Supplies', description: '', amount: '', expense_date: '' };

function PaymentsTab() {
  const { formatPrice } = useCurrency();
  const { currentBranchId } = useBranch();
  const [payments, setPayments] = useState([]);
  const [totals, setTotals] = useState({ total_collected: 0, total_refunded: 0 });
  const [filters, setFilters] = useState({ start: '', end: '', payment_method: '', payment_type: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentBranchId]);

  function loadPayments() {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    if (currentBranchId) params.branch_id = currentBranchId;
    api
      .get('/admin/payments', { params })
      .then(({ data }) => {
        setPayments(data.payments);
        setTotals({ total_collected: data.total_collected, total_refunded: data.total_refunded });
      })
      .catch(() => setError('Unable to load transactions.'))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <h2 className="font-display text-lg text-ink-900 dark:text-white">Transactions ({payments.length})</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Collected</p>
          <p className="mt-2 font-display text-2xl text-green-600">{formatPrice(totals.total_collected)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Refunded</p>
          <p className="mt-2 font-display text-2xl text-red-600">{formatPrice(totals.total_refunded)}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">From</label>
          <input
            type="date"
            value={filters.start}
            onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">To</label>
          <input
            type="date"
            value={filters.end}
            onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <select
          value={filters.payment_method}
          onChange={(e) => setFilters((f) => ({ ...f, payment_method: e.target.value }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        >
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select
          value={filters.payment_type}
          onChange={(e) => setFilters((f) => ({ ...f, payment_type: e.target.value }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        >
          <option value="">All types</option>
          {PAYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {(filters.start || filters.end || filters.payment_method || filters.payment_type) && (
          <button
            onClick={() => setFilters({ start: '', end: '', payment_method: '', payment_type: '' })}
            className="text-sm font-semibold text-slate-400 hover:text-brand-600"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading transactions...</p>}
      {!loading && payments.length === 0 && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No transactions match this filter.</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Recorded By</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(p.paid_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Link to={`/orders/${p.order_id}/receipt`} className="font-semibold text-brand-600 hover:text-brand-700">#{p.order_id}</Link>
                  </td>
                  <td className="px-4 py-3 text-ink-900 dark:text-white">{p.customer_name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.recorded_by_name || '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${p.payment_type === 'refund' ? 'text-red-600' : 'text-green-600'}`}>
                    {p.payment_type === 'refund' ? '-' : '+'}{formatPrice(p.amount)}
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

function InvoicesTab() {
  const { formatPrice } = useCurrency();
  const { currentBranchId } = useBranch();
  const [invoices, setInvoices] = useState([]);
  const [filters, setFilters] = useState({ status: '', start: '', end: '', search: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(loadInvoices, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentBranchId]);

  function loadInvoices() {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    if (currentBranchId) params.branch_id = currentBranchId;
    api
      .get('/admin/invoices', { params })
      .then(({ data }) => setInvoices(data.invoices))
      .catch(() => setError('Unable to load invoices.'))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <h2 className="font-display text-lg text-ink-900 dark:text-white">Invoices ({invoices.length})</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Generate an invoice from an order in the Order Queue tab — it appears here once created.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-2">
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search invoice # or customer..."
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        >
          <option value="">All statuses</option>
          {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Due From</label>
          <input
            type="date"
            value={filters.start}
            onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Due To</label>
          <input
            type="date"
            value={filters.end}
            onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        {(filters.status || filters.start || filters.end || filters.search) && (
          <button
            onClick={() => setFilters({ status: '', start: '', end: '', search: '' })}
            className="text-sm font-semibold text-slate-400 hover:text-brand-600"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading invoices...</p>}
      {!loading && invoices.length === 0 && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No invoices match this filter.</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice #</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Balance Due</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3">
                    <Link to={`/invoices/${inv.id}`} className="font-semibold text-brand-600 hover:text-brand-700">{inv.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(inv.due_date).toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-ink-900 dark:text-white">{inv.customer_name}</td>
                  <td className="px-4 py-3">
                    <Link to={`/orders/${inv.order_id}/receipt`} className="text-slate-500 hover:text-brand-600 dark:text-slate-400">#{inv.order_id}</Link>
                  </td>
                  <td className="px-4 py-3"><InvoiceStatusPill status={inv.payment_status} /></td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                    {Number(inv.balance_due) > 0 ? formatPrice(inv.balance_due) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink-900 dark:text-white">{formatPrice(inv.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExpensesTab() {
  const { formatPrice } = useCurrency();
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(NEW_EXPENSE);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  function loadExpenses() {
    setLoading(true);
    api
      .get('/admin/expenses')
      .then(({ data }) => {
        setExpenses(data.expenses);
        setTotal(data.total);
      })
      .catch(() => setError('Unable to load expenses.'))
      .finally(() => setLoading(false));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || !form.expense_date) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/admin/expenses', form);
      setForm(NEW_EXPENSE);
      loadExpenses();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to add that expense.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/admin/expenses/${id}`);
      loadExpenses();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete that expense.');
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg text-ink-900 dark:text-white">Expenses</h2>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total: {formatPrice(total)}</p>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {loading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading expenses...</p>}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {expenses.length === 0 && !loading && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">No expenses recorded yet.</td></tr>
                )}
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.expense_date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.category}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-900 dark:text-white">{formatPrice(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(e.id)} className="text-slate-300 hover:text-red-600" aria-label="Delete expense">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Add Expense</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Amount (GHS)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            required
            type="date"
            value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />} Add Expense
          </button>
        </form>
      </div>
    </div>
  );
}
