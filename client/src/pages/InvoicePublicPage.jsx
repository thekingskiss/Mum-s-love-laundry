import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import api from '../api/axios';
import InvoiceStatusPill from '../components/InvoiceStatusPill.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { SHOP_NAME } from '../lib/shopInfo.js';

function money(amount) {
  return `GHS ${Number(amount).toFixed(2)}`;
}

// No-login "pay this invoice" page — reached from the link texted/emailed by
// sendInvoice (invoiceController.js). Authorized purely by the unguessable
// token in the URL, same as a Stripe/Paystack-hosted invoice link.
export default function InvoicePublicPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(reference ? 'checking' : null);

  function loadInvoice() {
    return api
      .get(`/invoices/public/${token}`)
      .then(({ data }) => setInvoice(data.invoice))
      .catch((err) => setError(err.response?.data?.error || 'This invoice link is invalid or has expired.'));
  }

  useEffect(() => {
    loadInvoice().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!reference) return;
    api
      .get(`/invoices/public/${token}/verify/${reference}`)
      .then(({ data }) => {
        setVerifyStatus(data.status === 'success' ? 'success' : data.status === 'abandoned' || data.status === 'failed' ? 'failed' : 'pending');
        if (data.status === 'success') loadInvoice();
      })
      .catch(() => setVerifyStatus('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, token]);

  async function payNow() {
    const amount = Number(payAmount) || Number(invoice.balance_due);
    if (!(amount > 0)) return;
    setPayBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/invoices/public/${token}/pay`, { amount });
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to start this payment right now.');
      setPayBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-6 pb-16 pt-10">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <Skeleton className="h-8 w-40" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (error && !invoice) return <p className="mx-auto max-w-lg px-6 pb-16 pt-10 text-center text-sm text-red-600">{error}</p>;
  if (!invoice) return null;

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
      className="mx-auto max-w-lg px-6 pb-16 pt-10"
    >
      <Helmet>
        <title>{`Invoice ${invoice.invoice_number} — ${SHOP_NAME}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {verifyStatus === 'checking' && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/40">
          <Loader2 size={18} className="animate-spin text-brand-500" /> Confirming your payment...
        </div>
      )}
      {verifyStatus === 'success' && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
          <CheckCircle2 size={18} /> Payment successful — thank you!
        </div>
      )}
      {(verifyStatus === 'failed' || verifyStatus === 'error') && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          <XCircle size={18} /> That payment wasn't completed. No charge was made.
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-6 dark:border-slate-700">
          <div>
            <p className="font-display text-lg text-ink-900 dark:text-white">{SHOP_NAME}</p>
            <p className="mt-1 text-xs text-slate-400">{invoice.invoice_number}</p>
            <p className="mt-1 text-xs text-slate-400">Due {new Date(invoice.due_date).toISOString().slice(0, 10)}</p>
          </div>
          <InvoiceStatusPill status={status} />
        </div>

        <div className="mt-6 text-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Bill To</p>
          <p className="mt-1 font-medium text-ink-900 dark:text-white">{invoice.customer_name}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="mt-6 w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
              <tr>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-center font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {invoice.items.map((li, i) => (
                <tr key={i}>
                  <td className="py-2.5 text-ink-900 dark:text-white">{li.description}</td>
                  <td className="py-2.5 text-center text-slate-500 dark:text-slate-400">{li.quantity}</td>
                  <td className={`py-2.5 text-right font-medium ${li.line_total < 0 ? 'text-emerald-600' : 'text-ink-900 dark:text-white'}`}>
                    {money(li.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end border-t border-dashed border-slate-200 pt-4 dark:border-slate-700">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total</span>
            <span className="font-display text-2xl text-brand-600">{money(invoice.total_amount)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/40">
          <span className="text-slate-500 dark:text-slate-400">Paid: {money(invoice.amount_paid)}</span>
          {invoice.balance_due > 0 && (
            <span className="font-semibold text-amber-600 dark:text-amber-400">Balance due: {money(invoice.balance_due)}</span>
          )}
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {invoice.balance_due > 0 && !invoice.voided_at && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder={`${invoice.balance_due}`}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button
              onClick={payNow}
              disabled={payBusy}
              className="flex-1 rounded-full bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {payBusy ? 'Starting...' : 'Pay Now'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
