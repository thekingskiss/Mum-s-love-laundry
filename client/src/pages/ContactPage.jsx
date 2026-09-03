import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import SectionHeading from '../components/SectionHeading.jsx';
import api from '../api/axios';
import { useToast } from '../context/ToastContext.jsx';
import { SHOP_ADDRESS, SHOP_EMAIL, SHOP_HOURS, SHOP_PHONE } from '../lib/shopInfo.js';

const CONTACT_ITEMS = [
  { icon: MapPin, label: 'Address', value: SHOP_ADDRESS },
  { icon: Phone, label: 'Phone', value: SHOP_PHONE },
  { icon: Mail, label: 'Email', value: SHOP_EMAIL },
  { icon: Clock, label: 'Hours', value: SHOP_HOURS },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const initialForm = { name: '', email: '', message: '' };

export default function ContactPage() {
  const toast = useToast();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    if (!form.name.trim()) return 'Please enter your name.';
    if (!EMAIL_PATTERN.test(form.email.trim())) return 'Please enter a valid email address.';
    if (!form.message.trim()) return 'Please enter a message.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await api.post('/contact', form);
      setSent(true);
      setForm(initialForm);
    } catch (err) {
      // A submit-time failure (network/server) is an action result, not a
      // field-level validation error, so it gets a transient toast instead
      // of a persistent inline banner the user would need to dismiss.
      toast.error(err.response?.data?.error || 'Unable to send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Helmet>
        <title>Contact Us — Mum's Love Laundry</title>
        <meta
          name="description"
          content="Get in touch with Mum's Love Laundry in Akuapem-Akropong — address, phone, email, hours, and a contact form."
        />
      </Helmet>
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-14 text-center">
        <SectionHeading title="Get In Touch" eyebrow="Contact Us" />

        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
          {CONTACT_ITEMS.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-soft">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Icon size={18} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-medium text-ink-900">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-100 bg-white py-16">
        <div className="mx-auto max-w-xl px-6">
          <h3 className="text-center font-display text-2xl text-ink-900">Send Us a Message</h3>
          <p className="mt-1 text-center text-sm text-slate-500">
            Questions about an order or our services? We'll get back to you as soon as we can.
          </p>

          {sent ? (
            <motion.p
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-brand-50 px-4 py-6 font-semibold text-brand-600"
            >
              <CheckCircle2 size={20} /> Thanks — your message has been sent!
            </motion.p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={update('name')}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  placeholder="Your name"
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
                <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={update('message')}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  placeholder="How can we help?"
                />
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: submitting ? 1 : 1.03 }}
                whileTap={{ scale: submitting ? 1 : 0.97 }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Send Message
              </motion.button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
