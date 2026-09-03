import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import api from '../api/axios';
import { SHOP_NAME } from '../lib/shopInfo.js';

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const [status, setStatus] = useState('checking'); // checking | success | pending | failed | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reference) {
      setStatus('error');
      setError('No payment reference was found in the URL.');
      return;
    }
    api
      .get(`/paystack/verify/${reference}`)
      .then(({ data }) => {
        if (data.status === 'success') {
          setStatus('success');
        } else if (data.status === 'abandoned' || data.status === 'failed') {
          setStatus('failed');
        } else {
          setStatus('pending');
        }
      })
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.error || 'Unable to verify this payment.');
      });
  }, [reference]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 pb-16 pt-16 text-center">
      <Helmet>
        <title>Payment — {SHOP_NAME}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {status === 'checking' && (
        <>
          <Loader2 size={40} className="animate-spin text-brand-500" />
          <h1 className="mt-4 font-display text-xl font-semibold text-ink-900 dark:text-white">Confirming your payment...</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This only takes a moment.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 size={40} className="text-emerald-500" />
          <h1 className="mt-4 font-display text-xl font-semibold text-ink-900 dark:text-white">Payment successful</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your payment has been recorded. Thank you!</p>
          <Link to="/dashboard" className="mt-6 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
            Back to Dashboard
          </Link>
        </>
      )}

      {status === 'pending' && (
        <>
          <Loader2 size={40} className="text-amber-500" />
          <h1 className="mt-4 font-display text-xl font-semibold text-ink-900 dark:text-white">Payment pending</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            We haven't received confirmation yet. If you completed the payment, this will update shortly — check your Dashboard.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:text-slate-300"
          >
            Back to Dashboard
          </Link>
        </>
      )}

      {(status === 'failed' || status === 'error') && (
        <>
          <XCircle size={40} className="text-red-500" />
          <h1 className="mt-4 font-display text-xl font-semibold text-ink-900 dark:text-white">Payment not completed</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error || "This payment wasn't successful. No charge was made."}</p>
          <Link to="/dashboard" className="mt-6 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
            Back to Dashboard
          </Link>
        </>
      )}
    </div>
  );
}
