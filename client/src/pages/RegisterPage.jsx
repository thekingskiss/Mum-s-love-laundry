import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import mllLogo from '../assets/mll-logo.png';
import registerBgImage from '../assets/register-bg-laundry.jpg';

const initialForm = { full_name: '', email: '', phone_number: '', location_zone: '', date_of_birth: '', password: '' };
const PHONE_PATTERN = /^[+]?[\d\s-]{7,20}$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/zones')
      .then(({ data }) => setZones(data.zones))
      .catch(() => setZones([]));
  }, []);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!PHONE_PATTERN.test(form.phone_number.trim())) {
      setError('Please enter a valid phone number (digits, spaces, dashes, optional leading +).');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-6 py-16">
      <img
        src={registerBgImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[50%_20%]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-900/80 via-brand-800/80 to-brand-900/90" />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-soft">
        <div className="flex flex-col items-center text-center">
          <img src={mllLogo} alt="Mum's Love Laundry" className="h-14 w-auto" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Join Mum's Love Laundry in a few seconds.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
            <input
              required
              value={form.full_name}
              onChange={update('full_name')}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="Ama Serwaa"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={update('email')}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
            <input
              required
              value={form.phone_number}
              onChange={update('phone_number')}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="+233 20 000 0000"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Location Zone</label>
            <select
              required
              value={form.location_zone}
              onChange={update('location_zone')}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="" disabled>
                Select your zone
              </option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date of Birth (optional)</label>
            <input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.date_of_birth}
              onChange={update('date_of_birth')}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1 text-xs text-slate-400">Add it and we'll give you 5% off any order on your birthday 🎂</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={update('password')}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="At least 8 characters"
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
            Create Account
          </motion.button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
