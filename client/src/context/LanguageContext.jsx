import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { languageDirection, normalizeLanguage, translate } from '../lib/i18n';
import { useAuth } from './AuthContext.jsx';

const LanguageContext = createContext(null);
const LANGUAGE_KEY = 'mll_language';

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState(() => {
    try {
      return normalizeLanguage(localStorage.getItem(LANGUAGE_KEY));
    } catch {
      return 'en';
    }
  });

  // Tell the browser the page language and direction (right-to-left for Arabic).
  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = languageDirection(lang);
  }, [lang]);

  useEffect(() => {
    if (user?.preferred_language) setLangState(normalizeLanguage(user.preferred_language));
  }, [user?.preferred_language]);

  function setLang(next) {
    next = normalizeLanguage(next);
    setLangState(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // Storage may be unavailable; selection still applies for this tab.
    }
  }

  const value = useMemo(
    () => ({ lang, setLang, t: (key) => translate(lang, key) }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
