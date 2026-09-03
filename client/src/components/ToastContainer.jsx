import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { useToastState } from '../context/ToastContext.jsx';

const VARIANT_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300',
};

const VARIANT_ICONS = { success: CheckCircle2, error: XCircle };

export default function ToastContainer() {
  const { toasts, dismiss } = useToastState();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = VARIANT_ICONS[t.variant] || CheckCircle2;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium shadow-soft ${VARIANT_STYLES[t.variant] || VARIANT_STYLES.success}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
