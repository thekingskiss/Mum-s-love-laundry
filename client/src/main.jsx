import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { CurrencyProvider } from './context/CurrencyContext.jsx';
import { BranchProvider } from './context/BranchContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import App from './App.jsx';
import './index.css';

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
                    <App />
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
