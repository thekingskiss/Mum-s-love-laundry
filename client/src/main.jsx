import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { CurrencyProvider } from './context/CurrencyContext.jsx';
import { BranchProvider } from './context/BranchContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import App from './App.jsx';
import { listenForInstall, registerServiceWorker } from './lib/pwa.js';
import './index.css';

// Both must start before React does: the browser's install prompt can fire
// before the first render, and fires only once.
listenForInstall();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <BranchProvider>
            <ThemeProvider>
              <CurrencyProvider>
                <LanguageProvider>
                  <ToastProvider>
                    <MotionConfig reducedMotion="user">
                      <App />
                    </MotionConfig>
                  </ToastProvider>
                </LanguageProvider>
              </CurrencyProvider>
            </ThemeProvider>
          </BranchProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
