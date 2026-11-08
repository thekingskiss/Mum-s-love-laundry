import { useEffect, useRef, useState } from 'react';
import { FileText, Film, Image as ImageIcon, Loader2, Music, Paperclip, X } from 'lucide-react';
import api from '../../api/axios';
import VoiceRecorder from '../../components/VoiceRecorder';
import { ACCEPT, MAX_FILES, addFiles, fileKind, formatBytes } from '../../lib/messageFiles';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TARGETS = [
  { value: 'all', label: 'All Customers' },
  { value: 'single', label: 'Individual Customer' },
  { value: 'address', label: 'Any Email Address' },
];

// "Indirect" email shows the message in the customer's notifications and sends
// a copy; "direct" email goes straight to the inbox and leaves nothing in the app.
const DELIVERY_OPTIONS = [
  { value: 'in_app', label: 'In-app message', hint: 'Shows in their notifications only.' },
  { value: 'in_app_email', label: 'In-app + email copy', hint: 'Indirect: shows in the app and a copy is emailed.' },
  { value: 'email', label: 'Email only', hint: 'Direct: straight to their inbox, nothing in the app.' },
];

const KIND_ICONS = { image: ImageIcon, audio: Music, video: Film, document: FileText };

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white';

function toggleClass(active) {
  return `rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
    active
      ? 'border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-900/30'
      : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-300'
  }`;
}

function AttachmentChip({ file, onRemove }) {
  const kind = fileKind(file.name, file.type);
  const Icon = KIND_ICONS[kind] || FileText;
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (kind !== 'image') return undefined;
    // The thumbnail is a nicety; if the browser can't make one, show the icon.
    let url = '';
    try {
      url = URL.createObjectURL(file);
    } catch {
      return undefined;
    }
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);

  return (
    <li className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-600">
      {preview ? (
        <img src={preview} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
      ) : (
        <Icon size={16} className="shrink-0 text-brand-500" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium text-ink-900 dark:text-white">{file.name}</span>
      <span className="shrink-0 text-slate-400">{formatBytes(file.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="shrink-0 rounded p-0.5 text-slate-400 hover:text-red-500"
      >
        <X size={14} />
      </button>
    </li>
  );
}

function SendMessageForm() {
  const [target, setTarget] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [delivery, setDelivery] = useState('in_app_email');
  const [sendSms, setSendSms] = useState(false);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const fileInput = useRef(null);

  // A typed address isn't a customer account, so it can only be emailed directly.
  const effectiveDelivery = target === 'address' ? 'email' : delivery;

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

  function attach(incoming) {
    const { files: next, error: problem } = addFiles(files, incoming);
    setFiles(next);
    setError(problem);
    setResult('');
  }

  function pickTarget(next) {
    setTarget(next);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || (!body.trim() && files.length === 0)) return;
    if (target === 'single' && !selectedCustomer) {
      setError('Choose a customer to message.');
      return;
    }
    if (target === 'address' && !EMAIL_PATTERN.test(recipientEmail.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (target === 'all' && !window.confirm('Send this message to every customer account?')) {
      return;
    }

    const form = new FormData();
    form.append('title', title.trim());
    form.append('body', body.trim());
    form.append('delivery', effectiveDelivery);
    if (target === 'single') form.append('customer_id', selectedCustomer.id);
    if (target === 'address') form.append('recipient_email', recipientEmail.trim());
    if (sendSms && effectiveDelivery !== 'email') form.append('send_sms', 'true');
    files.forEach((file) => form.append('attachments', file, file.name));

    setSubmitting(true);
    setError('');
    setResult('');
    try {
      const { data } = await api.post('/admin/messages', form);

      const who =
        target === 'single'
          ? selectedCustomer.full_name
          : target === 'address'
            ? recipientEmail.trim()
            : `${data.recipient_count} customer${data.recipient_count === 1 ? '' : 's'}`;
      let summary = `Message ${effectiveDelivery === 'email' ? 'emailed' : 'sent'} to ${who}.`;
      if (data.attachment_count) summary += ` ${data.attachment_count} attachment${data.attachment_count === 1 ? '' : 's'} included.`;
      if (data.email_requested && data.email_sent_count < data.recipient_count) {
        summary += ` Only ${data.email_sent_count} of ${data.recipient_count} emails went out — check the mail settings and recipients' preferences.`;
      }
      setResult(summary);

      setTitle('');
      setBody('');
      setFiles([]);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setRecipientEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to send that message.');
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel =
    target === 'all'
      ? effectiveDelivery === 'email' ? 'Email All Customers' : 'Send to All Customers'
      : effectiveDelivery === 'email' ? 'Send Email' : 'Send Message';

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800"
    >
      <h2 className="font-display text-lg text-ink-900 dark:text-white">Send a Message</h2>

      <div className="flex flex-wrap gap-2">
        {TARGETS.map((t) => (
          <button key={t.value} type="button" onClick={() => pickTarget(t.value)} className={toggleClass(target === t.value)}>
            {t.label}
          </button>
        ))}
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
              className={inputClass}
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

      {target === 'address' && (
        <input
          type="email"
          required
          maxLength={255}
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="name@example.com"
          aria-label="Recipient email address"
          className={inputClass}
        />
      )}

      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">How should it be delivered?</legend>
        {target === 'address' ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sent as a direct email, since this address may not have an account. Nothing is posted in the app.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {DELIVERY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-xs transition ${
                  delivery === option.value
                    ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-slate-200 dark:border-slate-600'
                }`}
              >
                <span className="flex items-center gap-1.5 font-semibold text-ink-900 dark:text-white">
                  <input
                    type="radio"
                    name="delivery"
                    value={option.value}
                    checked={delivery === option.value}
                    onChange={() => setDelivery(option.value)}
                    className="accent-brand-500"
                  />
                  {option.label}
                </span>
                <span className="mt-1 block text-slate-500 dark:text-slate-400">{option.hint}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <input
        required
        maxLength={255}
        placeholder={effectiveDelivery === 'email' ? 'Subject' : 'Title'}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={inputClass}
      />
      <textarea
        required={files.length === 0}
        maxLength={2000}
        rows={4}
        placeholder={files.length ? 'Message (optional when you attach a file)' : 'Message'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={inputClass}
      />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            data-testid="attachment-input"
            onChange={(e) => {
              attach(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={files.length >= MAX_FILES}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
          >
            <Paperclip size={13} />
            Attach files
          </button>
          <VoiceRecorder disabled={files.length >= MAX_FILES} onRecorded={(file) => attach([file])} />
          <span className="text-[11px] text-slate-400">
            Images, audio, video, PDF, Office and text files · up to {MAX_FILES} files
          </span>
        </div>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1.5" aria-label="Attachments">
            {files.map((file, index) => (
              <AttachmentChip
                key={`${file.name}-${file.size}-${index}`}
                file={file}
                onRemove={() => setFiles((list) => list.filter((_, i) => i !== index))}
              />
            ))}
          </ul>
        )}
      </div>

      {effectiveDelivery !== 'email' && (
        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} className="h-3.5 w-3.5 accent-brand-500" />
          Also send the text by SMS (attachments are not sent by SMS)
        </label>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      {result && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{result}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        {submitLabel}
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
