import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, MessageCircle, RotateCcw, SendHorizontal, X } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useMediaQuery } from '../lib/useMediaQuery.js';
import { SHOP_PHONE } from '../lib/shopInfo.js';

const BOT_NAME = 'Mum’s Helper';
const STORAGE_KEY = 'mll_chat_v1';
const MAX_SAVED_MESSAGES = 60;
const MAX_LENGTH = 500;
// Tailwind's `sm` breakpoint: below it the chat fills the screen like a phone app.
const SM_QUERY = '(min-width: 640px)';
const MD_QUERY = '(min-width: 768px)';

const WELCOME = {
  id: 'welcome',
  role: 'bot',
  text: `Hi, I'm ${BOT_NAME}! 👋 I can help with prices, opening hours, how drop-off works and tracking your orders. What would you like to know?`,
  suggestions: ['Prices', 'Opening hours', 'How do I book?', 'Track my order'],
  actions: [],
};

// Pages where a floating button would sit on top of something the person is
// busy with (workspaces, the booking wizard, printable pages, payment screens).
const HIDDEN_PREFIXES = ['/staff', '/admin', '/book', '/settings', '/orders', '/pay', '/payments', '/invoices'];
const HAS_TAB_BAR = ['/dashboard'];

const matchesPath = (pathname, prefixes) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

// The server decides what a link may point at; the browser only follows ones it
// recognises, so a reply can never smuggle in a script or look-alike address.
function safeHref(href) {
  if (typeof href !== 'string') return null;
  if (/^(tel:\+?[\d\s-]+|mailto:[^\s@]+@[^\s@]+)$/i.test(href)) return href;
  if (/^https:\/\/(wa\.me\/\d+|www\.google\.com\/maps\/)/i.test(href)) return href;
  return null;
}
const safeRoute = (to) => (typeof to === 'string' && /^\/[a-z0-9\-/]*$/i.test(to) ? to : null);

let nextId = 0;
const newId = () => `m${Date.now().toString(36)}${(nextId += 1)}`;

function loadSaved(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    // A conversation can mention someone's orders, so it never carries over to
    // a different (or logged-out) account in the same browser tab.
    if (saved && saved.userId === (userId ?? null) && Array.isArray(saved.messages) && saved.messages.length > 0) {
      return saved.messages;
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return [WELCOME];
}

function save(userId, messages) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ userId: userId ?? null, messages: messages.slice(-MAX_SAVED_MESSAGES) })
    );
  } catch {
    /* storage unavailable: the chat still works, it just isn't remembered */
  }
}

// On phones the on-screen keyboard shrinks the *visual* viewport but not the
// layout one, which would hide the message box behind it. Follow the visual one.
function useVisualViewport(active) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !viewport) {
      setBox(null);
      return undefined;
    }
    const update = () => setBox({ height: viewport.height, top: viewport.offsetTop });
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [active]);
  return box;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1.5" role="status" aria-label={`${BOT_NAME} is typing`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ animationDelay: `${i * 150}ms` }}
          className="h-2 w-2 animate-bounce rounded-full bg-slate-400 motion-reduce:animate-none dark:bg-slate-500"
        />
      ))}
    </div>
  );
}

function ActionButton({ action, onNavigate }) {
  const className =
    'inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-brand-800 dark:bg-slate-900 dark:text-brand-300 dark:hover:bg-slate-800';

  const route = safeRoute(action.to);
  if (route) {
    return (
      <Link to={route} onClick={onNavigate} className={className}>
        {action.label}
      </Link>
    );
  }
  const href = safeHref(action.href);
  if (!href) return null;
  const external = href.startsWith('https:');
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {action.label}
      {external && <ExternalLink size={12} aria-hidden="true" />}
    </a>
  );
}

function Message({ message, isLast, busy, onSend, onNavigate }) {
  const isUser = message.role === 'user';
  return (
    <li className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={[
          'max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-md bg-brand-500 text-white'
            : 'rounded-bl-md bg-slate-100 text-ink-900 dark:bg-slate-800 dark:text-slate-100',
          message.error ? 'border border-red-200 dark:border-red-900' : '',
        ].join(' ')}
      >
        {message.text}
      </div>

      {!isUser && message.actions?.length > 0 && (
        <div className="mt-2 flex max-w-[95%] flex-wrap gap-2">
          {message.actions.map((action) => (
            <ActionButton key={action.label} action={action} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {!isUser && isLast && !busy && message.suggestions?.length > 0 && (
        <div className="mt-2 flex max-w-[95%] flex-wrap gap-2" role="group" aria-label="Suggested questions">
          {message.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSend(suggestion)}
              className="min-h-[2.25rem] rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:bg-brand-950/50 dark:text-brand-300 dark:hover:bg-brand-950"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

export default function ChatWidget() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const userId = user?.id ?? null;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadSaved(userId));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const isSmUp = useMediaQuery(SM_QUERY, true);
  const isDesktop = useMediaQuery(MD_QUERY, true);
  const viewport = useVisualViewport(open && !isSmUp);

  const panelRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const wasOpen = useRef(false);
  const titleId = useId();

  // Sign in, sign out or switch account: start a fresh conversation.
  const lastUser = useRef(userId);
  useEffect(() => {
    if (lastUser.current === userId) return;
    lastUser.current = userId;
    setMessages(loadSaved(userId));
    setBusy(false);
  }, [userId]);

  useEffect(() => {
    save(userId, messages);
  }, [userId, messages]);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (open && list) list.scrollTop = list.scrollHeight;
  }, [messages, busy, open, viewport]);

  // Move focus into the chat when it opens and back to the button when it closes.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus({ preventScroll: true });
    } else if (wasOpen.current) {
      launcherRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);

  // Full-screen on phones: the page behind must not scroll under the chat.
  useEffect(() => {
    if (!open || isSmUp) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, isSmUp]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      // Full screen on a phone: keep Tab inside the chat, as the page behind is covered.
      if (event.key === 'Tab' && !isSmUp && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isSmUp]);

  // A page change on a phone should reveal the page, not leave it hidden behind the chat.
  const closeIfPhone = useCallback(() => {
    if (!isSmUp) setOpen(false);
  }, [isSmUp]);

  const send = useCallback(
    async (text) => {
      const message = String(text ?? '').trim().slice(0, MAX_LENGTH);
      if (!message || busy) return;

      setMessages((current) => [...current, { id: newId(), role: 'user', text: message }]);
      setDraft('');
      setBusy(true);

      try {
        const { data } = await api.post('/chat', { message });
        setMessages((current) => [
          ...current,
          {
            id: newId(),
            role: 'bot',
            text: data.reply,
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
            actions: Array.isArray(data.actions) ? data.actions : [],
          },
        ]);
      } catch (error) {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        const serverMessage = error.response?.data?.error;
        const text = offline
          ? 'It looks like you’re offline. Check your connection and try again.'
          : error.response?.status === 400 || error.response?.status === 429
            ? serverMessage || 'Sorry, I couldn’t send that. Please try again.'
            : error.response?.status === 401
              ? 'Your login has expired. Please log in again and ask me once more.'
              : `Sorry, I can’t answer right now. Please try again in a moment, or call us on ${SHOP_PHONE}.`;
        setMessages((current) => [
          ...current,
          {
            id: newId(),
            role: 'bot',
            error: true,
            text,
            suggestions: [],
            actions: offline ? [] : [{ label: `Call ${SHOP_PHONE}`, href: `tel:${SHOP_PHONE}` }],
          },
        ]);
      } finally {
        setBusy(false);
        inputRef.current?.focus({ preventScroll: true });
      }
    },
    [busy]
  );

  function handleSubmit(event) {
    event.preventDefault();
    send(draft);
  }

  function reset() {
    setMessages([WELCOME]);
    setDraft('');
    inputRef.current?.focus({ preventScroll: true });
  }

  if (matchesPath(pathname, HIDDEN_PREFIXES)) return null;

  // Phones with the dashboard's bottom tab bar: sit above it.
  const aboveTabBar = matchesPath(pathname, HAS_TAB_BAR) && !isDesktop;
  const launcherOffset = aboveTabBar
    ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))]'
    : 'bottom-[max(1rem,env(safe-area-inset-bottom))]';

  // On a phone the panel is the whole visual viewport; from `sm` up it's a card
  // above the button.
  const phoneBox = !isSmUp && viewport ? { height: viewport.height, top: viewport.top, bottom: 'auto' } : undefined;

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            ref={launcherRef}
            type="button"
            key="launcher"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setOpen(true)}
            aria-label="Chat with us"
            aria-haspopup="dialog"
            aria-expanded="false"
            className={`fixed right-4 z-50 flex h-14 items-center gap-2 rounded-full bg-brand-500 px-4 text-white shadow-xl shadow-brand-900/25 transition-colors hover:bg-brand-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 sm:right-6 ${launcherOffset}`}
          >
            <MessageCircle size={24} aria-hidden="true" />
            <span className="hidden text-sm font-semibold sm:inline">Chat with us</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-labelledby={titleId}
            aria-modal={!isSmUp ? 'true' : undefined}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            style={phoneBox}
            className={[
              'fixed z-[70] flex flex-col overflow-hidden bg-white dark:bg-slate-900',
              // Phone: full screen.
              'inset-x-0 top-0 h-dvh',
              // Larger screens: a card in the corner.
              'sm:inset-x-auto sm:right-6 sm:top-auto sm:h-[min(36rem,calc(100dvh-7rem))] sm:w-[24rem] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl dark:sm:border-slate-700',
              // Tablets still show the dashboard tab bar, so lift the card above it.
              aboveTabBar
                ? 'sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:h-[min(36rem,calc(100dvh-9rem))]'
                : 'sm:bottom-6',
            ].join(' ')}
          >
            <header className="flex shrink-0 items-center gap-3 bg-brand-500 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white sm:pt-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20"
              >
                <MessageCircle size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate font-display text-base font-bold leading-tight">
                  {BOT_NAME}
                </h2>
                <p className="truncate text-xs text-white/85">Mum’s Love Laundry assistant</p>
              </div>
              <button
                type="button"
                onClick={reset}
                aria-label="Start a new conversation"
                title="Start over"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <RotateCcw size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <ol
              ref={listRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label="Conversation"
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
            >
              {messages.map((message, index) => (
                <Message
                  key={message.id}
                  message={message}
                  isLast={index === messages.length - 1}
                  busy={busy}
                  onSend={send}
                  onNavigate={closeIfPhone}
                />
              ))}
              {busy && (
                <li className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-slate-100 px-3 dark:bg-slate-800">
                    <TypingDots />
                  </div>
                </li>
              )}
            </ol>

            <form
              onSubmit={handleSubmit}
              className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <label htmlFor={`${titleId}-input`} className="sr-only">
                Type your question
              </label>
              <input
                id={`${titleId}-input`}
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={MAX_LENGTH}
                placeholder="Type your question…"
                autoComplete="off"
                enterKeyHint="send"
                // 16px on phones: anything smaller makes iOS zoom the page when the box is focused.
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-ink-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-brand-900 sm:text-sm"
              />
              <button
                type="submit"
                disabled={busy || draft.trim() === ''}
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SendHorizontal size={18} aria-hidden="true" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
