import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { useInstall } from '../lib/pwa.js';

// Pages where a banner would get in the way of what the person is doing.
const QUIET_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/book', '/pay', '/payments', '/orders', '/invoices'];
const SHOW_AFTER_MS = 4000;

export function IosInstallSteps({ className = '' }) {
  return (
    <ol className={`space-y-2 text-sm text-slate-600 dark:text-slate-300 ${className}`}>
      <li className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <Share size={14} />
        </span>
        <span>
          Tap <strong>Share</strong> in your browser's toolbar.
        </span>
      </li>
      <li className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <PlusSquare size={14} />
        </span>
        <span>
          Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
        </span>
      </li>
    </ol>
  );
}

/**
 * A dismissible banner offering to install the app. Phones only: on larger
 * screens the same option lives in the account menu instead.
 */
export default function InstallPrompt({ aboveTabBar = false }) {
  const { canInstall, dismissed, ios, hasNativePrompt, install, dismiss } = useInstall();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  const quiet = QUIET_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const visible = ready && canInstall && !dismissed && !quiet;

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          role="dialog"
          aria-label="Install Mum's Love Laundry"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className={[
            'fixed inset-x-3 z-[60] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:hidden',
            aboveTabBar
              ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
              : 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]',
          ].join(' ')}
        >
          <div className="flex items-start gap-3">
            <img src="/icons/icon-192.png" alt="" width="44" height="44" className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Install Mum's Love</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Add it to your home screen to track orders faster, even with a weak connection.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className="-me-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>

          {showSteps && ios && <IosInstallSteps className="mt-3" />}

          <div className="mt-3 flex gap-2">
            {hasNativePrompt ? (
              <button
                type="button"
                onClick={install}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-brand-600"
              >
                <Download size={16} /> Install app
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSteps((value) => !value)}
                aria-expanded={showSteps}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-brand-600"
              >
                <Download size={16} /> {showSteps ? 'Hide steps' : 'How to install'}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Not now
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
