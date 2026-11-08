import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, WifiOff } from 'lucide-react';
import { applyUpdate, useOnlineStatus, useUpdateReady } from '../lib/pwa.js';

/**
 * Connection and version notices for the installed app: a strip when the phone
 * is offline, and a prompt when a new release has been downloaded.
 */
export default function PwaStatus({ aboveTabBar = false }) {
  const online = useOnlineStatus();
  const updateReady = useUpdateReady();

  return (
    <>
      {/* Sits at the very top, under the status bar. */}
      <AnimatePresence>
        {!online && (
          <motion.div
            role="status"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed inset-x-0 top-0 z-[90] overflow-hidden bg-slate-900 text-white"
          >
            <p className="flex items-center justify-center gap-2 px-4 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] text-center text-xs font-medium">
              <WifiOff size={14} className="shrink-0" />
              You're offline. Some things won't load until you reconnect.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {updateReady && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className={[
              'fixed inset-x-3 z-[95] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-3 ps-4 text-white shadow-2xl dark:bg-slate-100 dark:text-slate-900',
              aboveTabBar
                ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4'
                : 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]',
            ].join(' ')}
          >
            <RefreshCw size={16} className="shrink-0" />
            <p className="min-w-0 flex-1 text-sm font-medium">A new version is ready.</p>
            <button
              type="button"
              onClick={applyUpdate}
              className="min-h-10 shrink-0 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600 active:scale-[0.98]"
            >
              Update
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
