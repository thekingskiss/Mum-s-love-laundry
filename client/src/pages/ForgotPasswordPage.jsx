import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/axios';
import mllLogo from '../assets/mll-logo.png';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to process that request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-soft">
        <div className="flex flex-col items-center text-center">
          <img src={mllLogo} alt="Mum's Love Laundry" className="h-14 w-auto" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your email and we'll send you a reset link.</p>
        </div>

        {result ? (
          <div className="mt-8">
            <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> {result.message}
            </p>
            {result.devResetLink && (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Dev only — email isn't configured yet
                </p>
                <a
                  href={result.devResetLink}
                  className="mt-1.5 block break-all text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  {result.devResetLink}
                </a>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                placeholder="you@example.com"
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Send Reset Link
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
