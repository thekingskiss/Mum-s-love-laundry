import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import mllLogo from '../assets/mll-logo.png';
import loginBgImage from '../assets/login-bg-laundromat.jpg';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to log in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-6 py-16">
      <img
        src={loginBgImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[75%_15%]"
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(168,64,44,0.78) 0%, rgba(122,44,28,0.85) 100%)',
        }}
      />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-soft">
        <div className="flex flex-col items-center text-center">
          <img src={mllLogo} alt="Mum's Love Laundry" className="h-14 w-auto" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Log in to track your orders and book a drop-off.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={{ scale: submitting ? 1 : 1.02 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Log In
          </motion.button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
