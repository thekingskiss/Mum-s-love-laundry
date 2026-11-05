import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  MapPin,
  Package,
  Plus,
  Printer,
  Receipt,
  Shirt,
  Wallet,
  X,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ProgressTracker from '../components/ProgressTracker.jsx';
import StatusPill from '../components/StatusPill.jsx';
import PaymentStatusPill from '../components/PaymentStatusPill.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { CUSTOMER_CANCELLABLE_STATUSES } from '../lib/orderLifecycle';
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS, suggestPaymentType } from '../lib/payments';
import { timeAgo, useNotifications } from '../lib/useNotifications';

const TERMINAL_STATUSES = ['completed', 'cancelled'];
const SUB_PAGES = ['orders', 'payments', 'pricing', 'notifications'];
const OVERVIEW_ORDER_LIMIT = 3;
const CARD_CLASS = 'rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800';

function ordersWithBalance(orders) {
  return orders.filter((order) => order.status !== 'cancelled' && Number(order.balance_due) > 0);
}

function orderTitle(order) {
  return order.items_summary || `${order.item_count} item(s)`;
}

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const requestedPage = searchParams.get('tab');
  const page = SUB_PAGES.includes(requestedPage) ? requestedPage : 'overview';

  const notifications = useNotifications();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingOrder, setPayingOrder] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  function loadOrders() {
    setLoading(true);
    setError('');
    api
      .get('/orders/user')
      .then(({ data }) => setOrders(data.orders))
      .catch(() => setError('Unable to load your orders right now.'))
      .finally(() => setLoading(false));
  }

  const orderProps = { orders, loading, error, onPay: setPayingOrder };

  return (
    <motion.div
      key={page}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto max-w-5xl px-6 pb-16 pt-10"
    >
      {page === 'overview' && <OverviewPage {...orderProps} unreadCount={notifications.unreadCount} />}
      {page === 'orders' && <MyOrdersPage {...orderProps} onChanged={loadOrders} />}
      {page === 'payments' && <PaymentsPage {...orderProps} />}
      {page === 'pricing' && <PriceListPage />}
      {page === 'notifications' && <NotificationsPage {...notifications} />}

      {payingOrder && <PayNowModal order={payingOrder} onClose={() => setPayingOrder(null)} />}
    </motion.div>
  );
}

function PageHeading({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

function BookButton() {
  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
      <Link
        to="/book"
        className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-600"
      >
        <Plus size={16} /> Book a Drop-off
      </Link>
    </motion.div>
  );
}

function ErrorMessage({ children }) {
  return <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{children}</p>;
}

function NoActiveOrders() {
  return (
    <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-800">
      <Package className="text-slate-300" size={40} />
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">You have no active orders right now.</p>
      <Link to="/book" className="mt-4 text-sm font-semibold text-brand-600 hover:text-brand-700">
        Book your first drop-off →
      </Link>
    </div>
  );
}

function SummaryCard({ to, icon: Icon, label, value, detail }) {
  return (
    <Link
      to={to}
      className={`${CARD_CLASS} p-5 transition hover:border-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <Icon size={18} className="text-slate-400" />
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-ink-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </Link>
  );
}

function OverviewPage({ orders, loading, error, unreadCount }) {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();

  const activeOrders = orders.filter((o) => !TERMINAL_STATUSES.includes(o.status));
  const owing = ordersWithBalance(orders);
  const owingTotal = owing.reduce((sum, order) => sum + Number(order.balance_due), 0);

  return (
    <>
      <div className={`flex flex-col justify-between gap-6 p-8 sm:flex-row sm:items-center ${CARD_CLASS}`}>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">Welcome back, {user?.full_name?.split(' ')[0]}</h1>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <MapPin size={15} /> {user?.location_zone}
            </span>
            <span className="flex items-center gap-1.5">
              <Shirt size={15} /> {orders.length} total order{orders.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <BookButton />
      </div>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {loading && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <SummaryCard
              to="/dashboard?tab=orders"
              icon={ClipboardList}
              label="Active orders"
              value={activeOrders.length}
              detail="In progress at the shop"
            />
            <SummaryCard
              to="/dashboard?tab=payments"
              icon={Wallet}
              label="Balance due"
              value={formatPrice(owingTotal)}
              detail={owing.length === 0 ? 'Nothing to pay' : `Across ${owing.length} order${owing.length === 1 ? '' : 's'}`}
            />
            <SummaryCard
              to="/dashboard?tab=notifications"
              icon={Bell}
              label="Notifications"
              value={unreadCount}
              detail="Unread"
            />
          </div>

          <div className="mt-10 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Current orders</h2>
            {orders.length > 0 && (
              <Link to="/dashboard?tab=orders" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                View all orders
              </Link>
            )}
          </div>

          {activeOrders.length === 0 && <NoActiveOrders />}

          <div className="mt-4 space-y-3">
            {activeOrders.slice(0, OVERVIEW_ORDER_LIMIT).map((order) => (
              <div key={order.id} className={`p-5 ${CARD_CLASS}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900 dark:text-white">{orderTitle(order)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {order.pickup_date
                        ? `Pickup on ${order.pickup_date.slice(0, 10)}`
                        : `Dropped off ${order.drop_off_date?.slice(0, 10)}`}
                    </p>
                  </div>
                  <StatusPill status={order.status} />
                </div>
                {order.late_fee > 0 && (
                  <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <AlertTriangle size={14} className="shrink-0" />
                    A storage fee of {formatPrice(order.late_fee)} has accrued. Please collect it soon.
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function MyOrdersPage({ orders, loading, error, onPay, onChanged }) {
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const [cancellingId, setCancellingId] = useState(null);
  const [expandedPayments, setExpandedPayments] = useState(null);
  const [paymentsByOrder, setPaymentsByOrder] = useState({});
  const [paymentsLoading, setPaymentsLoading] = useState(null);

  async function handleCancel(orderId) {
    setCancellingId(orderId);
    try {
      await api.post(`/orders/${orderId}/cancel`);
      onChanged();
      toast.success('Order cancelled.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to cancel that order.');
    } finally {
      setCancellingId(null);
    }
  }

  async function togglePayments(orderId) {
    if (expandedPayments === orderId) {
      setExpandedPayments(null);
      return;
    }
    setExpandedPayments(orderId);
    if (!paymentsByOrder[orderId]) {
      setPaymentsLoading(orderId);
      try {
        const { data } = await api.get(`/orders/${orderId}/payments`);
        setPaymentsByOrder((p) => ({ ...p, [orderId]: data.payments }));
      } catch {
        setPaymentsByOrder((p) => ({ ...p, [orderId]: [] }));
      } finally {
        setPaymentsLoading(null);
      }
    }
  }

  const activeOrders = orders.filter((o) => !TERMINAL_STATUSES.includes(o.status));
  const pastOrders = orders.filter((o) => TERMINAL_STATUSES.includes(o.status));

  return (
    <>
      <PageHeading title="My Orders" description="Track your laundry and see past orders.">
        <BookButton />
      </PageHeading>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Active Orders</h2>

        {loading && (
          <div className="mt-4 space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="mt-4 h-10 w-full" />
                <Skeleton className="mt-6 h-2 w-full" />
              </div>
            ))}
          </div>
        )}
        {error && <ErrorMessage>{error}</ErrorMessage>}

        {!loading && !error && activeOrders.length === 0 && <NoActiveOrders />}

        <div className="mt-4 space-y-4">
          {activeOrders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06, ease: 'easeOut' }}
              className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-900 dark:text-white">{orderTitle(order)}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar size={13} /> Drop-off on {order.drop_off_date?.slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={order.status} />
                  <span className="font-semibold text-brand-600">{formatPrice(order.total_price)}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {order.discount_amount > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                    🎂 Birthday discount: −{formatPrice(order.discount_amount)}
                  </span>
                )}
                <PaymentStatusPill status={order.payment_status} />
                {order.balance_due > 0 && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Balance due: {formatPrice(order.balance_due)}
                  </span>
                )}
                {order.balance_due > 0 && order.status !== 'cancelled' && (
                  <button
                    onClick={() => onPay(order)}
                    className="flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600"
                  >
                    <Wallet size={13} /> Pay Now
                  </button>
                )}
                <button
                  onClick={() => togglePayments(order.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  <Receipt size={13} /> {expandedPayments === order.id ? 'Hide' : 'View'} Payment History
                  {expandedPayments === order.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {expandedPayments === order.id && (
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  {paymentsLoading === order.id && <p className="text-xs text-slate-400">Loading payments...</p>}
                  {paymentsLoading !== order.id && (paymentsByOrder[order.id] || []).length === 0 && (
                    <p className="text-xs text-slate-400">No payments recorded yet.</p>
                  )}
                  {(paymentsByOrder[order.id] || []).length > 0 && (
                    <ul className="space-y-1.5">
                      {paymentsByOrder[order.id].map((p) => (
                        <li key={p.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>
                            {new Date(p.paid_at).toLocaleDateString()} — {PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type} ({PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method})
                          </span>
                          <span className={`font-semibold ${p.payment_type === 'refund' ? 'text-red-600' : 'text-green-600'}`}>
                            {p.payment_type === 'refund' ? '-' : '+'}{formatPrice(p.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {order.pickup_date ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:bg-brand-900/20 dark:text-brand-300">
                  <CheckCircle2 size={16} /> Ready for pickup on {order.pickup_date.slice(0, 10)}
                </div>
              ) : (
                <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                  We'll let you know your pickup date once your order is confirmed.
                </div>
              )}

              {order.late_fee > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Ready for {order.days_ready_for_pickup} days — a storage fee of {formatPrice(order.late_fee)} has
                    accrued ({order.days_overdue} day{order.days_overdue === 1 ? '' : 's'} overdue). Please collect
                    it soon.
                  </span>
                </motion.div>
              )}

              <div className="mt-6">
                <ProgressTracker status={order.status} />
              </div>
              <div className="mt-4 flex items-center justify-end gap-4">
                <Link
                  to={`/orders/${order.id}/receipt`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-brand-600"
                >
                  <Printer size={14} /> Print Receipt
                </Link>
                {CUSTOMER_CANCELLABLE_STATUSES.includes(order.status) && (
                  <button
                    onClick={() => handleCancel(order.id)}
                    disabled={cancellingId === order.id}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-red-600 disabled:opacity-50"
                  >
                    <X size={14} /> {cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {pastOrders.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Order History</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
            <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Items</th>
                  <th className="px-6 py-3 font-medium">Drop-off Date</th>
                  <th className="px-6 py-3 font-medium">Pickup Date</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Payment</th>
                  <th className="px-6 py-3 text-right font-medium">Price</th>
                  <th className="px-6 py-3 text-right font-medium"><span className="sr-only">Receipt</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {pastOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 font-medium text-ink-900 dark:text-white">{orderTitle(order)}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{order.drop_off_date?.slice(0, 10)}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{order.pickup_date?.slice(0, 10) || '—'}</td>
                    <td className="px-6 py-4">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="px-6 py-4">
                      <PaymentStatusPill status={order.payment_status} />
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-brand-600">
                      {formatPrice(order.total_price)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/orders/${order.id}/receipt`} className="text-slate-400 transition hover:text-brand-600" title="Print Receipt">
                        <Printer size={16} className="inline" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PaymentsPage({ orders, loading, error, onPay }) {
  const { formatPrice } = useCurrency();
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState('');

  useEffect(() => {
    api
      .get('/orders/user/payments')
      .then(({ data }) => setPayments(data.payments))
      .catch(() => setPaymentsError('Unable to load your payment history right now.'))
      .finally(() => setPaymentsLoading(false));
  }, []);

  const owing = ordersWithBalance(orders);
  const ordersById = new Map(orders.map((order) => [order.id, order]));

  return (
    <>
      <PageHeading title="Payments" description="See what you owe and everything you've paid." />

      <h2 className="mt-10 text-lg font-semibold text-ink-900 dark:text-white">Balance due</h2>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {loading && <Skeleton className="mt-4 h-20 rounded-2xl" />}
      {!loading && !error && owing.length === 0 && (
        <p className={`mt-4 p-6 text-sm text-slate-500 dark:text-slate-400 ${CARD_CLASS}`}>You have nothing to pay right now.</p>
      )}
      <div className="mt-4 space-y-3">
        {owing.map((order) => (
          <div key={order.id} className={`flex flex-wrap items-center justify-between gap-3 p-5 ${CARD_CLASS}`}>
            <div className="min-w-0">
              <p className="font-semibold text-ink-900 dark:text-white">{orderTitle(order)}</p>
              <p className="mt-1 text-xs text-slate-400">
                Order #{order.id} · {formatPrice(order.total_price)} total
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-brand-600">{formatPrice(order.balance_due)}</span>
              <button
                onClick={() => onPay(order)}
                className="flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600"
              >
                <Wallet size={13} /> Pay Now
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-semibold text-ink-900 dark:text-white">Payment history</h2>
      {paymentsError && <ErrorMessage>{paymentsError}</ErrorMessage>}
      {paymentsLoading && <Skeleton className="mt-4 h-32 rounded-2xl" />}
      {!paymentsLoading && !paymentsError && payments.length === 0 && (
        <p className={`mt-4 p-6 text-sm text-slate-500 dark:text-slate-400 ${CARD_CLASS}`}>No payments recorded yet.</p>
      )}
      {payments.length > 0 && (
        <div className={`mt-4 overflow-hidden ${CARD_CLASS}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Order</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Method</th>
                  <th className="px-6 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {payments.map((p) => {
                  const order = ordersById.get(p.order_id);
                  return (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500 dark:text-slate-400">{new Date(p.paid_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-medium text-ink-900 dark:text-white">
                        #{p.order_id}{order ? ` · ${orderTitle(order)}` : ''}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}</td>
                      <td className={`whitespace-nowrap px-6 py-4 text-right font-semibold ${p.payment_type === 'refund' ? 'text-red-600' : 'text-green-600'}`}>
                        {p.payment_type === 'refund' ? '-' : '+'}{formatPrice(p.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// Read only, and from the public list, so customers only ever get active items.
function PriceListPage() {
  const { formatPrice } = useCurrency();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .get('/items')
      .then(({ data }) => setItems(data.items))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const query = search.trim().toLowerCase();
  const grouped = items
    .filter((item) => !query || `${item.item_name} ${item.category}`.toLowerCase().includes(query))
    .reduce((groups, item) => {
      groups[item.category] = groups[item.category] || [];
      groups[item.category].push(item);
      return groups;
    }, {});
  const categories = Object.entries(grouped);

  return (
    <>
      <PageHeading
        title="Pricing"
        description="What each item costs. A price range is confirmed when you drop off."
      >
        <BookButton />
      </PageHeading>

      {failed && <ErrorMessage>Unable to load the price list right now.</ErrorMessage>}
      {loading && <Skeleton className="mt-6 h-32 rounded-2xl" />}

      {!loading && !failed && (
        <>
          <input
            aria-label="Search the price list"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items or categories..."
            className="mt-6 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:max-w-xs"
          />

          {categories.length === 0 && (
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">No items match.</p>
          )}

          <div className="mt-6 space-y-8">
            {categories.map(([category, categoryItems]) => (
              <section key={category} aria-label={category}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-300">
                  {category} ({categoryItems.length})
                </h2>
                <div className={`mt-3 overflow-hidden ${CARD_CLASS}`}>
                  <table className="w-full text-left text-sm sm:table-fixed">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 font-medium">Item</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {categoryItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-white">{item.item_name}</td>
                          <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 sm:whitespace-nowrap">
                            {item.unit_price != null ? (
                              <span className="whitespace-nowrap">{formatPrice(item.unit_price)}</span>
                            ) : (
                              <>
                                <span className="whitespace-nowrap">{formatPrice(item.price_min)}</span>
                                {' – '}
                                <span className="whitespace-nowrap">{formatPrice(item.price_max)}</span>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function NotificationsPage({ notifications, unreadCount, loading, failed, markRead, markAllRead }) {
  return (
    <>
      <PageHeading title="Notifications" description="Updates about your orders and payments.">
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </PageHeading>

      {failed && notifications.length === 0 && <ErrorMessage>Unable to load your notifications right now.</ErrorMessage>}
      {loading && <Skeleton className="mt-6 h-32 rounded-2xl" />}

      {!loading && !failed && notifications.length === 0 && (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-800">
          <Bell className="text-slate-300" size={40} />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
        </div>
      )}

      {notifications.length > 0 && (
        <div className={`mt-6 overflow-hidden ${CARD_CLASS}`}>
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read_at && markRead(n.id)}
              className={`block w-full border-b border-slate-100 px-5 py-4 text-left transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50 ${
                n.read_at ? '' : 'bg-brand-50/50 dark:bg-brand-900/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-brand-500'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">{n.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function PayNowModal({ order, onClose }) {
  const { formatPrice } = useCurrency();
  const [amount, setAmount] = useState(String(order.balance_due));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handlePay(e) {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!(amountNum > 0) || amountNum > Number(order.balance_due) + 0.005) {
      setError(`Enter an amount up to the balance due (${formatPrice(order.balance_due)}).`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/paystack/initialize', {
        order_id: order.id,
        amount: amountNum,
        payment_type: suggestPaymentType(amountNum, order.balance_due, order.amount_paid),
      });
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to start this payment right now.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">Pay Now</h2>
            <p className="mt-1 text-xs text-slate-400">
              {orderTitle(order)} · Balance due {formatPrice(order.balance_due)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handlePay} className="mt-5 space-y-3">
          <div>
            <label htmlFor="dashboard-amount-ghs" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Amount (GHS)</label>
            <input id="dashboard-amount-ghs"
              type="number"
              step="0.01"
              min="0.01"
              max={order.balance_due}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Redirecting to Paystack...' : 'Pay with Paystack'}
          </button>
          <p className="text-center text-[11px] text-slate-400">You'll be redirected to Paystack's secure checkout to complete this payment.</p>
        </form>
      </motion.div>
    </div>
  );
}
