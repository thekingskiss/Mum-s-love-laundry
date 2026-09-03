import { motion } from 'framer-motion';
import { XCircle } from 'lucide-react';
import { MILESTONES, STATUS_LABELS, milestoneProgress } from '../lib/orderLifecycle';
import AnimatedNumber from './AnimatedNumber.jsx';

export default function ProgressTracker({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <XCircle size={18} className="text-slate-400" /> This order was cancelled.
      </div>
    );
  }

  const index = milestoneProgress(status);
  const percent = index >= 0 ? Math.round(((index + 1) / MILESTONES.length) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>{STATUS_LABELS[status] || status}</span>
        <span>
          <AnimatedNumber value={percent} format={(n) => `${Math.round(n)}%`} />
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className="h-full rounded-full bg-brand-500"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
