import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { THEMES, isDarkTheme, normalizeTheme, resolveTheme } from '../lib/themes.js';

const ThemeContext = createContext(null);
const THEME_KEY = 'mll_theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const CONTRAST_QUERY = '(prefers-contrast: more)';

function matches(query) {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;
}

// Tracks the device's colour-scheme and contrast settings, live.
function useDevicePreferences() {
  const [prefs, setPrefs] = useState(() => ({
    prefersDark: matches(DARK_QUERY),
    prefersContrast: matches(CONTRAST_QUERY),
  }));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const lists = [window.matchMedia(DARK_QUERY), window.matchMedia(CONTRAST_QUERY)];
    const update = () => setPrefs({ prefersDark: lists[0].matches, prefersContrast: lists[1].matches });
    lists.forEach((list) => list.addEventListener?.('change', update));
    return () => lists.forEach((list) => list.removeEventListener?.('change', update));
  }, []);

  return prefs;
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(() => {
    try {
      return normalizeTheme(localStorage.getItem(THEME_KEY));
    } catch {
      return 'light';
    }
  });
  const device = useDevicePreferences();
  const resolvedTheme = resolveTheme(theme, device);

  // Layout effect so the theme lands before the first paint, not after it.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDarkTheme(resolvedTheme));
    root.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage may be unavailable (private mode); the theme still works for this tab.
    }
  }, [theme]);

  useEffect(() => {
    if (user?.theme_preference) setThemeState(normalizeTheme(user.theme_preference));
  }, [user?.theme_preference]);

  const value = useMemo(() => {
    function setTheme(next) {
      setThemeState(normalizeTheme(next));
    }
    // Quick switch between the light and dark families; returns the new theme
    // so callers can save it.
    function toggleTheme() {
      const next = isDarkTheme(resolvedTheme) ? 'light' : 'dark';
      setThemeState(next);
      return next;
    }
    return { theme, resolvedTheme, themes: THEMES, setTheme, toggleTheme };
  }, [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
