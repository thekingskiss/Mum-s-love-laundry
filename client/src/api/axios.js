import axios from 'axios';
import { SESSION_ENDED_EVENT } from '../lib/sessionEvents.js';

const TOKEN_KEY = 'mll_token';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = Boolean(error.config?.headers?.Authorization);
    const isCredentialCheck = /\/auth\/(login|register|reset-password|forgot-password)$/.test(error.config?.url || '');
    // A wrong password at login is also a 401, but that isn't a lost session.
    if (error.response?.status === 401 && hadToken && !isCredentialCheck) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: error.response.data?.error }));
    }
    return Promise.reject(error);
  }
);

export default api;
