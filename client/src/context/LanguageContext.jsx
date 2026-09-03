import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translate } from '../lib/i18n';
import { useAuth } from './AuthContext.jsx';

const LanguageContext = createContext(null);
const LANGUAGE_KEY = 'mll_language';

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(LANGUAGE_KEY) || 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    if (user?.preferred_language) setLangState(user.preferred_language);
  }, [user?.preferred_language]);

  function setLang(next) {
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
