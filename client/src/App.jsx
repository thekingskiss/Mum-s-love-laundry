import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomeRoute from './components/HomeRoute.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import PwaStatus from './components/PwaStatus.jsx';
import { ADMIN_ROLES, STAFF_ROLES } from './lib/roles';
import { useTableCardLabels } from './lib/tableCards.js';

// Every page except the home page is loaded on demand, so a visitor to the
// marketing site doesn't download the staff and admin workspaces (the biggest
// code in the app) up front.
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const ServicesPage = lazy(() => import('./pages/ServicesPage.jsx'));
const PricingPage = lazy(() => import('./pages/PricingPage.jsx'));
const BlogPage = lazy(() => import('./pages/BlogPage.jsx'));
const ContactPage = lazy(() => import('./pages/ContactPage.jsx'));

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));

const BookingPage = lazy(() => import('./pages/BookingPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const StaffPage = lazy(() => import('./pages/StaffPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));

const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage.jsx'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage.jsx'));

const ReceiptPage = lazy(() => import('./pages/ReceiptPage.jsx'));
const OrderTagPage = lazy(() => import('./pages/OrderTagPage.jsx'));
const PaymentCallbackPage = lazy(() => import('./pages/PaymentCallbackPage.jsx'));
const InvoiceDetailPage = lazy(() => import('./pages/InvoiceDetailPage.jsx'));
const InvoicePublicPage = lazy(() => import('./pages/InvoicePublicPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading page">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  useTableCardLabels();

  const isDashboardRoute =
    location.pathname === '/dashboard' ||
    location.pathname === '/book' ||
    location.pathname === '/settings' ||
    location.pathname === '/staff' ||
    location.pathname === '/admin';

  return (
    <div className="min-h-dvh bg-white text-ink-900 dark:bg-ink-900 dark:text-slate-100">
      <ScrollToTop />
      <ToastContainer />
      <PwaStatus aboveTabBar={isDashboardRoute} />
      <InstallPrompt aboveTabBar={isDashboardRoute} />

      {!isDashboardRoute && <Navbar />}

      <main className="min-h-screen">
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Public pages */}
            <Route path="/" element={<HomeRoute />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />

            {/* Authentication */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Customer dashboard */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/book" element={<BookingPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Staff workspace (admins can open it to preview the staff view) */}
            <Route
              element={
                <ProtectedRoute roles={STAFF_ROLES}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/staff" element={<StaffPage />} />
            </Route>

            {/* Admin workspace */}
            <Route
              element={
                <ProtectedRoute roles={ADMIN_ROLES}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminPage />} />
            </Route>

            {/* Protected supporting pages */}
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

            {/* Public invoice payment page */}
            <Route
              path="/pay/invoice/:token"
              element={<InvoicePublicPage />}
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      {!isDashboardRoute && <Footer />}
    </div>
  );
}