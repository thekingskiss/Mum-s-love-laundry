import { AnimatePresence, motion } from 'framer-motion';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES } from '../lib/invoices';

export default function InvoiceStatusPill({ status }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${INVOICE_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}
      >
        {INVOICE_STATUS_LABELS[status] || status}
      </motion.span>
    </AnimatePresence>
  );
}
