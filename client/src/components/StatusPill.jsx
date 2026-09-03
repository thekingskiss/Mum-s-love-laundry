import { AnimatePresence, motion } from 'framer-motion';
import { STATUS_LABELS, STATUS_STYLES } from '../lib/orderLifecycle';

export default function StatusPill({ status }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}
      >
        {STATUS_LABELS[status] || status}
      </motion.span>
    </AnimatePresence>
  );
}
