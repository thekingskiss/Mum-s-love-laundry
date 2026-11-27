import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import BackgroundCarousel from './BackgroundCarousel.jsx';

// jsdom never loads images, so stand in for the browser's Image: it reports
// "loaded" as soon as a source is set.
class InstantImage {
  set src(value) {
    this._src = value;
    this.onload?.();
  }
}

function setReducedMotion(reduced) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced });
}

describe('BackgroundCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', InstantImage);
    setReducedMotion(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is hidden from screen readers and cannot take clicks', () => {
    render(<BackgroundCarousel />);
    const backdrop = screen.getByTestId('background-carousel');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveClass('pointer-events-none');
    expect(backdrop).toHaveClass('print:hidden');
  });

  it('starts with one photo and brings in the next one after a pause', () => {
    const { container } = render(<BackgroundCarousel />);
    expect(container.querySelectorAll('img')).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(9000);
    });
    const photos = container.querySelectorAll('img');
    expect(photos).toHaveLength(2);
    // The new photo is the visible one; the old one is fading out.
    expect(photos[1].className).toContain('opacity-[0.13]');
    expect(photos[0].className).toContain('opacity-0');
  });

  it('stays on the first photo when the visitor prefers reduced motion', () => {
    setReducedMotion(true);
    const { container } = render(<BackgroundCarousel />);
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
