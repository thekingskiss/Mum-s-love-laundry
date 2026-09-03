import { AnimatePresence, motion } from 'framer-motion';
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_STYLES } from '../lib/payments';

export default function PaymentStatusPill({ status }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${PAYMENT_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}
      >
        {PAYMENT_STATUS_LABELS[status] || status}
      </motion.span>
    </AnimatePresence>
  );
}
