import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);
const TOKEN_KEY = 'mll_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

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
    () => ({ user, loading, register, login, logout, updateProfile, uploadAvatar }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
