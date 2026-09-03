import { Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomeRoute from './components/HomeRoute.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import AboutPage from './pages/AboutPage.jsx';
import ServicesPage from './pages/ServicesPage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import BlogPage from './pages/BlogPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import BookingPage from './pages/BookingPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import StaffPage from './pages/StaffPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx';
import TermsOfServicePage from './pages/TermsOfServicePage.jsx';
import ReceiptPage from './pages/ReceiptPage.jsx';
import OrderTagPage from './pages/OrderTagPage.jsx';
import PaymentCallbackPage from './pages/PaymentCallbackPage.jsx';
import InvoiceDetailPage from './pages/InvoiceDetailPage.jsx';
import InvoicePublicPage from './pages/InvoicePublicPage.jsx';

const STAFF_ROLES = ['laundry_staff', 'administrator', 'super_admin'];

export default function App() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink-900 dark:bg-ink-900 dark:text-slate-100">
      <ScrollToTop />
      <ToastContainer />
      <Navbar />
      <main className="flex-1">
        {/* Keyed by path so navigating away from a crashed page resets the
            boundary instead of leaving it stuck on the error screen. */}
        <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/book"
            element={
              <ProtectedRoute>
                <BookingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id/receipt"
            element={
              <ProtectedRoute>
                <ReceiptPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id/tag"
            element={
              <ProtectedRoute roles={STAFF_ROLES}>
                <OrderTagPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute roles={STAFF_ROLES}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments/callback"
            element={
              <ProtectedRoute>
                <PaymentCallbackPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices/:id"
            element={
              <ProtectedRoute>
                <InvoiceDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="/pay/invoice/:token" element={<InvoicePublicPage />} />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
