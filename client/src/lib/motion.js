// Shared animation timing so transitions feel consistent site-wide rather
// than each component picking its own pace. Kept short and ease-out per
// design intent: clean and efficient, not flashy or sluggish.
export const DURATION = { fast: 0.2, base: 0.3, slow: 0.4 };
export const EASE_OUT = 'easeOut';

export const fadeSlideUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.base, ease: EASE_OUT },
};
