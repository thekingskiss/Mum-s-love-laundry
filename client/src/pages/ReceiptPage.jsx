import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Mail, MessageCircle, Printer, Smartphone } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import api from '../api/axios';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import StatusPill from '../components/StatusPill.jsx';
import PaymentStatusPill from '../components/PaymentStatusPill.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { STATUS_LABELS } from '../lib/orderLifecycle';
import { SHOP_ADDRESS, SHOP_EMAIL, SHOP_NAME, SHOP_PHONE } from '../lib/shopInfo.js';
import mllLogo from '../assets/mll-logo.png';

export default function ReceiptPage() {
  const { id } = useParams();
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [shareBusy, setShareBusy] = useState(null);

  async function shareReceipt(channel) {
    setShareBusy(channel);
    try {
      const { data } = await api.post(`/orders/${id}/receipt/send`, { channel });
      toast.success(`Receipt sent via ${channel === 'email' ? 'email' : 'SMS'} to ${data.to}.`);
    } catch (err) {
      toast.error(err.response?.data?.error || `Unable to send the receipt via ${channel === 'email' ? 'email' : 'SMS'}.`);
    } finally {
      setShareBusy(null);
    }
  }

  function shareOnWhatsApp() {
    const itemsText = order.items
      .map((item) => `${item.item_name} x${item.quantity} — ${formatPrice(item.line_total)}`)
      .join('\n');
    const lines = [
      `${SHOP_NAME} — Receipt #${order.id}`,
      `Customer: ${order.customer_name} (${order.customer_phone})`,
      `Drop-off: ${order.drop_off_date?.slice(0, 10)}`,
      '',
      itemsText,
      '',
      `Total: ${formatPrice(order.total_price)}`,
      `Paid: ${formatPrice(order.amount_paid)}`,
    ];
    if (order.balance_due > 0) lines.push(`Balance due: ${formatPrice(order.balance_due)}`);
    lines.push('', `Thank you for choosing ${SHOP_NAME}!`);

    const digits = (order.customer_phone || '').replace(/[^0-9]/g, '');
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  useEffect(() => {
    api
      .get(`/orders/${id}`)
      .then(({ data }) => setOrder(data.order))
      .catch((err) => setError(err.response?.data?.error || 'Unable to load this order.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-10">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-6 dark:border-slate-700">
            <Skeleton className="h-12 w-32" />
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-5 w-24" />
              <Skeleton className="ml-auto h-3 w-32" />
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
          <Skeleton className="mt-6 ml-auto h-8 w-32" />
        </div>
      </div>
    );
  }
  if (error) return <p className="mx-auto max-w-2xl px-6 pb-16 pt-10 text-sm text-red-600">{error}</p>;
  if (!order) return null;

  if (order.status === 'cancelled') {
    return (
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-10">
        <Helmet>
          <title>Receipt Unavailable — {SHOP_NAME}</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="flex flex-col items-center rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertTriangle className="text-amber-500" size={40} />
          <h1 className="mt-4 font-display text-xl font-semibold text-ink-900 dark:text-white">
            No Receipt Available
          </h1>
          <p className="mt-2 max-w-sm text-sm text-amber-700 dark:text-amber-300">
            Order #{order.id} was cancelled, so there's no completed order to
            issue a receipt for. If you believe this is a mistake, please
            contact us.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              to="/dashboard"
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Back to Dashboard
            </Link>
            <Link
              to="/contact"
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 dark:border-slate-600 dark:text-slate-300"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mx-auto max-w-2xl px-6 pb-16 pt-10"
    >
      <Helmet>
        <title>{`Receipt #${order.id} — ${SHOP_NAME}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div id="receipt-print-area" className="rounded-2xl border border-slate-100 bg-white p-8 shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-6 dark:border-slate-700">
          <div>
            <img src={mllLogo} alt={SHOP_NAME} className="h-12 w-auto" />
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {SHOP_ADDRESS}
              <br />
              {SHOP_PHONE} · {SHOP_EMAIL}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-lg text-ink-900 dark:text-white">Receipt #{order.id}</p>
            <p className="mt-1 text-xs text-slate-400">{new Date(order.created_at).toLocaleString()}</p>
            <div className="mt-2"><StatusPill status={order.status} /></div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Customer</p>
            <p className="mt-1 font-medium text-ink-900 dark:text-white">{order.customer_name}</p>
            <p className="text-slate-500 dark:text-slate-400">{order.customer_phone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Drop-off</p>
            <p className="mt-1 font-medium text-ink-900 dark:text-white">{order.drop_off_date?.slice(0, 10)}</p>
            {order.pickup_date && (
              <>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-400">Pickup</p>
                <p className="font-medium text-ink-900 dark:text-white">{order.pickup_date.slice(0, 10)}</p>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="mt-6 w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
              <tr>
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-center font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Unit Price</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 text-ink-900 dark:text-white">
                    {item.item_name}
                    {item.is_price_estimated && <span className="ml-1 text-xs text-slate-400">(est.)</span>}
                  </td>
                  <td className="py-2.5 text-center text-slate-500 dark:text-slate-400">{item.quantity}</td>
                  <td className="py-2.5 text-right text-slate-500 dark:text-slate-400">{formatPrice(item.unit_price)}</td>
                  <td className="py-2.5 text-right font-medium text-ink-900 dark:text-white">{formatPrice(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end border-t border-dashed border-slate-200 pt-4 dark:border-slate-700">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total</span>
            <span className="font-display text-2xl text-brand-600">{formatPrice(order.total_price)}</span>
          </div>
        </div>

        {order.discount_amount > 0 && (
          <p className="mt-1 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            🎂 Birthday Discount applied: −{formatPrice(order.discount_amount)}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <PaymentStatusPill status={order.payment_status} />
            <span className="text-slate-500 dark:text-slate-400">Paid: {formatPrice(order.amount_paid)}</span>
          </div>
          {order.balance_due > 0 && (
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              Balance due: {formatPrice(order.balance_due)}
            </span>
          )}
        </div>

        {order.late_fee > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-right text-sm dark:bg-amber-950/30">
            <p className="font-semibold text-amber-700 dark:text-amber-300">
              Late Pickup Fee ({order.days_overdue} day{order.days_overdue === 1 ? '' : 's'} overdue):{' '}
              {formatPrice(order.late_fee)}
            </p>
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Not included in the total above — due in person at pickup.
            </p>
          </div>
        )}

        {order.items.some((item) => item.is_price_estimated) && (
          <p className="mt-4 text-xs text-slate-400">
            (est.) — this item is range-priced; the exact price is confirmed at drop-off.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Thank you for choosing {SHOP_NAME}. Current status: {STATUS_LABELS[order.status] || order.status}.
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          Please collect within 7 days of pickup notice — {SHOP_NAME} is not
          responsible for items uncollected beyond that period.
        </p>
      </div>

      <div className="print:hidden mt-6 space-y-3">
        <button
          onClick={() => window.print()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-brand-600"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => shareReceipt('email')}
            disabled={shareBusy === 'email'}
            className="flex items-center justify-center gap-1.5 rounded-full border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
          >
            <Mail size={14} /> {shareBusy === 'email' ? 'Sending...' : 'Email'}
          </button>
          <button
            onClick={() => shareReceipt('sms')}
            disabled={shareBusy === 'sms'}
            className="flex items-center justify-center gap-1.5 rounded-full border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
          >
            <Smartphone size={14} /> {shareBusy === 'sms' ? 'Sending...' : 'SMS'}
          </button>
          <button
            onClick={shareOnWhatsApp}
            className="flex items-center justify-center gap-1.5 rounded-full border border-emerald-200 px-3 py-2.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
          >
            <MessageCircle size={14} /> WhatsApp
          </button>
        </div>
      </div>
    </motion.div>
  );
}
