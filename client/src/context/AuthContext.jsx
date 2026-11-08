import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { SESSION_ENDED_EVENT } from '../lib/sessionEvents.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'mll_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // The server revoked this login (deactivated account, changed password, or
  // expired token): drop the session so the app sends the person to log in.
  useEffect(() => {
    const onSessionEnded = () => setUser(null);
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
  }, []);

  // True when a saved login couldn't be checked because the server was
  // unreachable (offline, or down), as opposed to being rejected. The token is
  // kept in that case, so opening the installed app on a bad connection doesn't
  // sign anyone out.
  const [connectionError, setConnectionError] = useState(false);

  const restoreSession = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get('/auth/me')
      .then(({ data }) => {
        setConnectionError(false);
        setUser(data.user);
      })
      .catch((error) => {
        const status = error.response?.status;
        if (!status || status >= 500) {
          setConnectionError(true);
        } else {
          setConnectionError(false);
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Try again by itself as soon as the connection comes back.
  useEffect(() => {
    if (!connectionError) return undefined;
    window.addEventListener('online', restoreSession);
    return () => window.removeEventListener('online', restoreSession);
  }, [connectionError, restoreSession]);

  async function register(payload) {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setConnectionError(false);
    setUser(null);
  }

  async function updateProfile(payload) {
    const { data } = await api.patch('/auth/profile', payload);
    setUser(data.user);
    return data.user;
  }

  async function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await api.post('/auth/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setUser(data.user);
    return data.user;
  }

  const value = useMemo(
    () => ({ user, loading, connectionError, retrySession: restoreSession, register, login, logout, updateProfile, uploadAvatar }),
    [user, loading, connectionError, restoreSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
