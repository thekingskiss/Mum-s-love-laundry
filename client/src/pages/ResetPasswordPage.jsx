import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/axios';
import mllLogo from '../assets/mll-logo.png';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to reset your password. Please request a new link.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-soft">
        <div className="flex flex-col items-center text-center">
          <img src={mllLogo} alt="Mum's Love Laundry" className="h-14 w-auto" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">Choose a new password</h1>
        </div>

        {!token ? (
          <p className="mt-8 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
            This reset link is missing its token. Please request a new one from the{' '}
            <Link to="/forgot-password" className="font-semibold underline">forgot password</Link> page.
          </p>
        ) : success ? (
          <p className="mt-8 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> Password reset! Redirecting you to log in...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                placeholder="Re-enter your new password"
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Reset Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
