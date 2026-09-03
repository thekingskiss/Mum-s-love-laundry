import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Download, Plus, Send, Trash2 } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import InvoiceStatusPill from '../components/InvoiceStatusPill.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { INVOICE_LINE_KINDS } from '../lib/invoices';
import { SHOP_NAME } from '../lib/shopInfo.js';

const STAFF_ROLES = ['laundry_staff', 'administrator', 'super_admin'];
const ADMIN_ROLES = ['administrator', 'super_admin'];

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const isStaff = STAFF_ROLES.includes(user.role);
  const isAdmin = ADMIN_ROLES.includes(user.role);

  const [invoice, setInvoice] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [lineForm, setLineForm] = useState({ kind: 'fee', description: '', quantity: 1, unit_amount: '' });
  const [lineBusy, setLineBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [voidBusy, setVoidBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.get(`/invoices/${id}`), api.get(`/invoices/${id}/activity`)])
      .then(([invRes, actRes]) => {
        setInvoice(invRes.data.invoice);
        setActivity(actRes.data.activity);
      })
      .catch((err) => setError(err.response?.data?.error || 'Unable to load this invoice.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addLine(e) {
    e.preventDefault();
    if (!lineForm.description.trim() || !lineForm.unit_amount) return;
    setLineBusy(true);
    setError('');
    try {
      await api.post(`/admin/invoices/${id}/lines`, {
        kind: lineForm.kind,
        description: lineForm.description.trim(),
        quantity: Number(lineForm.quantity) || 1,
        unit_amount: lineForm.unit_amount,
      });
      setLineForm({ kind: 'fee', description: '', quantity: 1, unit_amount: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to add that line.');
    } finally {
      setLineBusy(false);
    }
  }

  async function removeLine(lineId) {
    setError('');
    try {
      await api.delete(`/admin/invoices/${id}/lines/${lineId}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to remove that line.');
    }
  }

  async function sendInvoice() {
    setSendBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/admin/invoices/${id}/send`);
      navigator.clipboard?.writeText(data.link).catch(() => {});
      toast.success('Invoice sent — pay link copied to your clipboard.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to send this invoice.');
    } finally {
      setSendBusy(false);
    }
  }

  async function voidInvoice() {
    if (!window.confirm('Void this invoice? This cannot be undone.')) return;
    setVoidBusy(true);
    setError('');
    try {
      await api.delete(`/admin/invoices/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to void this invoice.');
    } finally {
      setVoidBusy(false);
    }
  }

  async function downloadPdf() {
    setPdfBusy(true);
    setError('');
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Unable to download the PDF.');
    } finally {
      setPdfBusy(false);
    }
  }

  async function postMessage(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setMessageBusy(true);
    setError('');
    try {
      await api.post(`/invoices/${id}/activity`, { body: message.trim() });
      setMessage('');
      const { data } = await api.get(`/invoices/${id}/activity`);
      setActivity(data.activity);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to post that message.');
    } finally {
      setMessageBusy(false);
    }
  }

  async function payNow() {
    const amount = Number(payAmount) || Number(invoice.balance_due);
    if (!(amount > 0)) return;
    setPayBusy(true);
    setError('');
    try {
      const { data } = await api.post('/paystack/initialize', {
        order_id: invoice.order_id,
        amount,
        payment_type: 'partial',
      });
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to start this payment right now.');
      setPayBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-10">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <Skeleton className="h-8 w-40" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (error && !invoice) return <p className="mx-auto max-w-2xl px-6 pb-16 pt-10 text-sm text-red-600">{error}</p>;
  if (!invoice) return null;

  const itemLines = invoice.items.filter((li) => li.kind === 'item');
  const adjustmentLines = invoice.items.filter((li) => li.kind !== 'item');
  const status = invoice.voided_at
    ? 'voided'
    : invoice.balance_due <= 0
    ? 'paid'
    : Number(invoice.amount_paid) > 0
    ? 'partial'
    : 'not_paid';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mx-auto max-w-2xl px-6 pb-16 pt-10"
    >
      <Helmet>
        <title>{`Invoice ${invoice.invoice_number} — ${SHOP_NAME}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-6 dark:border-slate-700">
          <div>
            <p className="font-display text-lg text-ink-900 dark:text-white">{invoice.invoice_number}</p>
            <p className="mt-1 text-xs text-slate-400">Order #{invoice.order_id}</p>
            <p className="mt-1 text-xs text-slate-400">Due {new Date(invoice.due_date).toISOString().slice(0, 10)}</p>
          </div>
          <InvoiceStatusPill status={status} />
        </div>

        <div className="mt-6 text-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Bill To</p>
          <p className="mt-1 font-medium text-ink-900 dark:text-white">{invoice.customer_name}</p>
          <p className="text-slate-500 dark:text-slate-400">{invoice.customer_phone}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="mt-6 w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
              <tr>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-center font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Unit</th>
                <th className="py-2 text-right font-medium">Amount</th>
                {isStaff && !invoice.voided_at && <th className="py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {itemLines.map((li) => (
                <tr key={li.id}>
                  <td className="py-2.5 text-ink-900 dark:text-white">{li.description}</td>
                  <td className="py-2.5 text-center text-slate-500 dark:text-slate-400">{li.quantity}</td>
                  <td className="py-2.5 text-right text-slate-500 dark:text-slate-400">{formatPrice(li.unit_amount)}</td>
                  <td className="py-2.5 text-right font-medium text-ink-900 dark:text-white">{formatPrice(li.line_total)}</td>
                  {isStaff && !invoice.voided_at && <td />}
                </tr>
              ))}
              {adjustmentLines.map((li) => (
                <tr key={li.id}>
                  <td className="py-2.5 text-ink-900 dark:text-white">
                    {li.description} <span className="text-xs text-slate-400">({INVOICE_LINE_KINDS.find((k) => k.value === li.kind)?.label || li.kind})</span>
                  </td>
                  <td className="py-2.5 text-center text-slate-500 dark:text-slate-400">{li.quantity}</td>
                  <td className="py-2.5 text-right text-slate-500 dark:text-slate-400">{formatPrice(li.unit_amount)}</td>
                  <td className={`py-2.5 text-right font-medium ${li.line_total < 0 ? 'text-emerald-600' : 'text-ink-900 dark:text-white'}`}>
                    {formatPrice(li.line_total)}
                  </td>
                  {isStaff && !invoice.voided_at && (
                    <td className="py-2.5 text-right">
                      <button onClick={() => removeLine(li.id)} className="text-slate-300 hover:text-red-500" title="Remove line">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isStaff && !invoice.voided_at && (
          <form onSubmit={addLine} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
            <select
              value={lineForm.kind}
              onChange={(e) => setLineForm((f) => ({ ...f, kind: e.target.value }))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              {INVOICE_LINE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <input
              placeholder="Description"
              value={lineForm.description}
              onChange={(e) => setLineForm((f) => ({ ...f, description: e.target.value }))}
              className="min-w-[8rem] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <input
              type="number"
              min="1"
              value={lineForm.quantity}
              onChange={(e) => setLineForm((f) => ({ ...f, quantity: e.target.value }))}
              className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount"
              value={lineForm.unit_amount}
              onChange={(e) => setLineForm((f) => ({ ...f, unit_amount: e.target.value }))}
              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={lineBusy}
              className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              <Plus size={13} /> Add
            </button>
          </form>
        )}

        <div className="mt-4 flex justify-end border-t border-dashed border-slate-200 pt-4 dark:border-slate-700">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total</span>
            <span className="font-display text-2xl text-brand-600">{formatPrice(invoice.total_amount)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/40">
          <span className="text-slate-500 dark:text-slate-400">Paid: {formatPrice(invoice.amount_paid)}</span>
          {invoice.balance_due > 0 && (
            <span className="font-semibold text-amber-600 dark:text-amber-400">Balance due: {formatPrice(invoice.balance_due)}</span>
          )}
        </div>

        {!isStaff && invoice.balance_due > 0 && !invoice.voided_at && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder={`${invoice.balance_due}`}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button
              onClick={payNow}
              disabled={payBusy}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {payBusy ? 'Starting...' : 'Pay Now'}
            </button>
          </div>
        )}

        {invoice.notes && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">Note: {invoice.notes}</p>}

        {error && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertTriangle size={14} /> {error}
          </p>
        )}

        {isStaff && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-dashed border-slate-200 pt-4 dark:border-slate-700">
            <button
              onClick={downloadPdf}
              disabled={pdfBusy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
            >
              <Download size={13} /> {pdfBusy ? 'Downloading...' : 'Download PDF'}
            </button>
            {!invoice.voided_at && (
              <button
                onClick={sendInvoice}
                disabled={sendBusy}
                className="flex items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
              >
                <Send size={13} /> {sendBusy ? 'Sending...' : 'Send to Customer'}
              </button>
            )}
            {isAdmin && !invoice.voided_at && (
              <button
                onClick={voidInvoice}
                disabled={voidBusy}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={13} /> {voidBusy ? 'Voiding...' : 'Void Invoice'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <h2 className="font-display text-base text-ink-900 dark:text-white">Activity</h2>
        <ul className="mt-4 space-y-3">
          {activity.map((a) => (
            <li key={a.id} className="text-sm">
              <p className="text-ink-900 dark:text-white">{a.body || a.event_type}</p>
              <p className="text-xs text-slate-400">
                {a.actor_name ? `${a.actor_name} · ` : ''}{new Date(a.created_at).toLocaleString()}
              </p>
            </li>
          ))}
          {activity.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
        </ul>

        {isStaff && (
          <form onSubmit={postMessage} className="mt-4 flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Post a message..."
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={messageBusy || !message.trim()}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Post
            </button>
          </form>
        )}
      </div>

      <Link
        to={isStaff ? '/staff' : '/dashboard'}
        className="mt-6 block text-center text-sm font-semibold text-slate-400 hover:text-brand-600"
      >
        ← Back
      </Link>
    </motion.div>
  );
}
