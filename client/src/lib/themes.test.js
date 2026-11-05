import { describe, it, expect } from 'vitest';
import { THEMES, isDarkTheme, normalizeTheme, resolveTheme } from './themes.js';

describe('normalizeTheme', () => {
  it('keeps known themes', () => {
    for (const { id } of THEMES) expect(normalizeTheme(id)).toBe(id);
  });

  it.each([undefined, null, '', 'sepia'])('falls back to light for %s', (value) => {
    expect(normalizeTheme(value)).toBe('light');
  });
});

describe('resolveTheme', () => {
  it('returns an explicit choice whatever the device prefers', () => {
    expect(resolveTheme('midnight', { prefersDark: false, prefersContrast: true })).toBe('midnight');
    expect(resolveTheme('light', { prefersDark: true })).toBe('light');
  });

  it.each([
    [false, false, 'light'],
    [true, false, 'dark'],
    [false, true, 'contrast'],
    [true, true, 'contrast-dark'],
  ])('maps system with dark=%s contrast=%s to %s', (prefersDark, prefersContrast, expected) => {
    expect(resolveTheme('system', { prefersDark, prefersContrast })).toBe(expected);
  });
});

describe('isDarkTheme', () => {
  it('flags the dark family', () => {
    expect(['dark', 'graphite', 'midnight', 'contrast-dark'].every(isDarkTheme)).toBe(true);
    expect(['light', 'gray', 'contrast', 'system'].some(isDarkTheme)).toBe(false);
  });
});
