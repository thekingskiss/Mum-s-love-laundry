import { useEffect, useState } from 'react';
import laundryRoom from '../assets/laundry-room.jpg';
import foldingClothes from '../assets/folding-clothes.jpg';
import ironingBoard from '../assets/ironing-board.jpg';
import laundromatMachines from '../assets/laundromat-machines.jpg';
import foldedKnits from '../assets/folded-knits.jpg';

const SLIDES = [laundryRoom, foldingClothes, ironingBoard, laundromatMachines, foldedKnits];

// How long each photo stays before the next fades in.
const HOLD_MS = 9000;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// A faint, slowly changing photo behind every page. It sits under the content
// (see the stacking note in App.jsx), never takes clicks, and is skipped when
// printing. Photos are only fetched when their turn comes, so it adds one image
// to the first load rather than five.
export default function BackgroundCarousel() {
  const [active, setActive] = useState(0);
  // Slides that have been shown at least once. A slide stays mounted after that
  // so it can fade out instead of vanishing.
  const [shown, setShown] = useState(() => new Set([0]));

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    let cancelled = false;
    const timer = setTimeout(() => {
      const next = (active + 1) % SLIDES.length;
      const preload = new Image();
      preload.onload = () => {
        if (cancelled) return;
        setShown((current) => new Set(current).add(next));
        setActive(next);
      };
      // A photo that fails to load is skipped; the current one stays up.
      preload.src = SLIDES[next];
    }, HOLD_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active]);

  return (
    <div
      aria-hidden="true"
      data-testid="background-carousel"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden"
    >
      {SLIDES.map((src, index) =>
        shown.has(index) ? (
          <img
            key={src}
            src={src}
            alt=""
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[2500ms] ease-in-out motion-reduce:transition-none ${
              index === active ? 'opacity-[0.13] dark:opacity-[0.09]' : 'opacity-0'
            }`}
          />
        ) : null
      )}
    </div>
  );
}
