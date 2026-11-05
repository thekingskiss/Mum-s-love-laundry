import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../api/axios';

function SendMessageForm() {
  const [target, setTarget] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    if (target !== 'single' || selectedCustomer || !customerSearch.trim()) {
      setCustomerResults([]);
      return undefined;
    }
    const timeout = setTimeout(() => {
      api
        .get('/admin/customers', { params: { search: customerSearch } })
        .then(({ data }) => setCustomerResults(data.customers))
        .catch(() => setCustomerResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerSearch, target, selectedCustomer]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (target === 'single' && !selectedCustomer) {
      setError('Choose a customer to message.');
      return;
    }
    if (target === 'all' && !window.confirm('Send this message to every customer account?')) {
      return;
    }

    setSubmitting(true);
    setError('');
    setResult('');
    try {
      const { data } = await api.post('/admin/messages', {
        title: title.trim(),
        body: body.trim(),
        customer_id: target === 'single' ? selectedCustomer.id : undefined,
        send_email: sendEmail,
        send_sms: sendSms,
      });
      setResult(
        target === 'single'
          ? `Message sent to ${selectedCustomer.full_name}.`
          : `Message sent to ${data.recipient_count} customer${data.recipient_count === 1 ? '' : 's'}.`
      );
      setTitle('');
      setBody('');
      setSelectedCustomer(null);
      setCustomerSearch('');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to send that message.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800"
    >
      <h2 className="font-display text-lg text-ink-900 dark:text-white">Send a Message</h2>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setTarget('all');
            setError('');
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            target === 'all'
              ? 'border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-900/30'
              : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-300'
          }`}
        >
          All Customers
        </button>
        <button
          type="button"
          onClick={() => {
            setTarget('single');
            setError('');
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            target === 'single'
              ? 'border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-900/30'
              : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-300'
          }`}
        >
          Individual Customer
        </button>
      </div>

      {target === 'single' && (
        selectedCustomer ? (
          <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm dark:border-brand-900/50 dark:bg-brand-900/20">
            <span className="font-medium text-ink-900 dark:text-white">
              {selectedCustomer.full_name} · {selectedCustomer.phone_number}
            </span>
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search by name, email, or username..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            {customerResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-600 dark:bg-slate-800">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerResults([]);
                      setCustomerSearch('');
                    }}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <span className="font-medium text-ink-900 dark:text-white">{c.full_name}</span>
                    <span className="text-xs text-slate-400">{c.phone_number} · {c.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}

      <input
        required
        maxLength={255}
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
      />
      <textarea
        required
        maxLength={2000}
        rows={4}
        placeholder="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
      />

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-3.5 w-3.5 accent-brand-500" />
          Also send by email
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} className="h-3.5 w-3.5 accent-brand-500" />
          Also send by SMS
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      {result && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{result}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        {target === 'all' ? 'Send to All Customers' : 'Send Message'}
      </button>
    </form>
  );
}

export function MessagesTab({ isAdmin }) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, []);

  function loadMessages() {
    setLoading(true);
    api
      .get('/contact')
      .then(({ data }) => setMessages(data.messages))
      .catch(() => setError('Unable to load messages.'))
      .finally(() => setLoading(false));
  }

  async function markRead(id) {
    try {
      await api.patch(`/contact/${id}/read`);
      loadMessages();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to mark that message read.');
    }
  }

  return (
    <div>
      {isAdmin && <SendMessageForm />}

      <h2 className={`font-display text-lg text-ink-900 dark:text-white ${isAdmin ? 'mt-10' : ''}`}>
        Contact Messages ({messages.length})
      </h2>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading messages...</p>}
      {!loading && messages.length === 0 && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No messages yet.</p>}

      <div className="mt-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl border p-5 shadow-soft ${
              m.read_at ? 'border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800' : 'border-brand-200 bg-brand-50/40 dark:border-brand-900/50 dark:bg-brand-950/20'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink-900 dark:text-white">{m.name} <span className="font-normal text-slate-400">&lt;{m.email}&gt;</span></p>
                <p className="mt-1 text-xs text-slate-400">{new Date(m.created_at).toLocaleString()}</p>
              </div>
              {!m.read_at && (
                <button onClick={() => markRead(m.id)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200">
                  Mark as read
                </button>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{m.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
