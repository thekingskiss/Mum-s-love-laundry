// Colour themes. Each concrete theme sets data-theme on <html>; dark ones also
// set the `dark` class so every existing dark: utility applies. The palettes
// themselves live in index.css as CSS variables behind the slate/ink/brand and
// semantic Tailwind colours, so a theme repaints the app without new classes.
//
// `swatch` drives the preview tiles in Settings and is deliberately hard-coded,
// so each tile shows its own theme whatever theme is active.

export const THEMES = [
  {
    id: 'light',
    label: 'Light',
    description: 'Bright canvas for daytime use',
    dark: false,
    swatch: { canvas: '#f8fafc', surface: '#ffffff', line: '#e2e8f0', text: '#0f172a', accent: '#eb1c1c' },
  },
  {
    id: 'gray',
    label: 'Gray',
    description: 'Neutral grays, no blue tint',
    dark: false,
    swatch: { canvas: '#f4f4f4', surface: '#ffffff', line: '#e0e0e0', text: '#161616', accent: '#eb1c1c' },
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Deep slate for low light',
    dark: true,
    swatch: { canvas: '#020617', surface: '#0f172a', line: '#1e293b', text: '#f1f5f9', accent: '#f4413b' },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'Neutral charcoal dark',
    dark: true,
    swatch: { canvas: '#262626', surface: '#333333', line: '#474747', text: '#f4f4f4', accent: '#f4413b' },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Pure black with raised panels; easy on OLED batteries',
    dark: true,
    swatch: { canvas: '#000000', surface: '#121212', line: '#262626', text: '#f4f4f4', accent: '#f4413b' },
  },
  {
    id: 'contrast',
    label: 'High contrast',
    description: 'Darker text and borders, strong focus rings',
    dark: false,
    swatch: { canvas: '#ffffff', surface: '#ffffff', line: '#0f172a', text: '#000000', accent: '#a30f0f' },
  },
  {
    id: 'contrast-dark',
    label: 'High contrast dark',
    description: 'Bright text on black, strong focus rings',
    dark: true,
    swatch: { canvas: '#000000', surface: '#000000', line: '#f8fafc', text: '#ffffff', accent: '#ff7873' },
  },
  {
    id: 'system',
    label: 'System',
    description: "Follows your device's light/dark and contrast settings",
    dark: null,
    swatch: null,
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const DEFAULT_THEME = 'light';

export function normalizeTheme(value) {
  return THEME_IDS.includes(value) ? value : DEFAULT_THEME;
}

// Turns a preference into the concrete theme to paint. Only `system` depends on
// the device: dark and/or "increase contrast" pick the matching variant.
export function resolveTheme(preference, { prefersDark = false, prefersContrast = false } = {}) {
  const theme = normalizeTheme(preference);
  if (theme !== 'system') return theme;
  if (prefersContrast) return prefersDark ? 'contrast-dark' : 'contrast';
  return prefersDark ? 'dark' : 'light';
}

export function isDarkTheme(resolvedTheme) {
  return Boolean(THEMES.find((t) => t.id === resolvedTheme)?.dark);
}
