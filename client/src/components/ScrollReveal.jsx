import { motion } from 'framer-motion';
import { DURATION, EASE_OUT } from '../lib/motion.js';

// Fades/slides a section in as it scrolls into view via Framer Motion's
// built-in Intersection Observer support (whileInView) — no manual observer
// wiring needed. `onReveal` fires at that same moment — pair it with
// AnimatedNumber to count up exactly when a stat scrolls into view, instead
// of on page load. Defaults to revealing once (the norm for page content —
// re-fading-in every time you scroll past it reads as noisy); pass
// `once={false}` with `onLeave` for something that should reset and replay
// every time, like a stat counter.
export default function ScrollReveal({ children, delay = 0, className = '', onReveal, onLeave, once = true }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      onViewportEnter={onReveal}
      onViewportLeave={onLeave}
      viewport={{ once, margin: '-80px' }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
