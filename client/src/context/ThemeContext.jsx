import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const ThemeContext = createContext(null);
const THEME_KEY = 'mll_theme';

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage may be unavailable (private mode); the toggle still works for this tab.
    }
  }, [theme]);

  useEffect(() => {
    if (user?.theme_preference) setThemeState(user.theme_preference);
  }, [user?.theme_preference]);

  function setTheme(next) {
    setThemeState(next === 'dark' ? 'dark' : 'light');
  }

  function toggleTheme() {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
