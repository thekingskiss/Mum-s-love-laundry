import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

// Counts up (or down) from its previous value to `value` whenever `value`
// changes, rather than just snapping — used for stat tiles and progress
// percentages so updates feel alive instead of static. Defaults to starting
// from 0 so the very first mount counts up too (not just later updates) —
// pair with a `value` that only becomes truthy once revealed for a
// scroll-triggered count-up (see AboutPage's stats).
export default function AnimatedNumber({ value, format = (n) => Math.round(n).toString(), duration = 1.6, from = 0 }) {
  const [display, setDisplay] = useState(from);
  const previous = useRef(from);

  useEffect(() => {
    const controls = animate(previous.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(latest),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return <>{format(display)}</>;
}
