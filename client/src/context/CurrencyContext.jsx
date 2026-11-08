import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext.jsx';

const CurrencyContext = createContext(null);
const CURRENCY_KEY = 'mll_currency';

// Prices are always created and stored in GHS — this only controls how
// they're displayed. Rates are set manually by an admin (Staff → Currencies),
// not pulled from a live exchange feed.
export function CurrencyProvider({ children }) {
  const { user } = useAuth();
  const [currencies, setCurrencies] = useState([{ code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GHS', rate_to_ghs: 1 }]);
  const [code, setCodeState] = useState(() => {
    try {
      return localStorage.getItem(CURRENCY_KEY) || 'GHS';
    } catch {
      return 'GHS';
    }
  });

  useEffect(() => {
    api
      .get('/currencies')
      .then(({ data }) => {
        if (data.currencies?.length) setCurrencies(data.currencies);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.preferred_currency) setCodeState(user.preferred_currency);
  }, [user?.preferred_currency]);

  function setCode(next) {
    setCodeState(next);
    try {
      localStorage.setItem(CURRENCY_KEY, next);
    } catch {
      // Storage may be unavailable; selection still applies for this tab.
    }
  }

  const active = currencies.find((c) => c.code === code) || currencies[0];

  const formatPrice = useCallback(
    (ghsAmount) => {
      const amount = Number(ghsAmount) || 0;
      const converted = amount * Number(active.rate_to_ghs);
      return `${active.symbol} ${converted.toFixed(2)}`;
    },
    [active]
  );

  // Price-list label for a catalogue item: a fixed price, or a min–max range.
  const formatItemPrice = useCallback(
    (item) => {
      if (item.unit_price != null) return formatPrice(item.unit_price);
      const rate = Number(active.rate_to_ghs);
      const min = (Number(item.price_min) || 0) * rate;
      const max = (Number(item.price_max) || 0) * rate;
      return `${active.symbol} ${min.toFixed(2)} – ${max.toFixed(2)}`;
    },
    [active, formatPrice]
  );

  const value = useMemo(
    () => ({ currencies, code, setCode, active, formatPrice, formatItemPrice }),
    [currencies, code, active, formatPrice, formatItemPrice]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
