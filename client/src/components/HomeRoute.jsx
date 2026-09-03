import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LandingPage from '../pages/LandingPage.jsx';

const STAFF_ROLES = ['laundry_staff', 'administrator', 'super_admin'];

// Signed-in users land on their dashboard instead of the marketing
// homepage — the landing page is only for logged-out visitors. Gated on
// `loading` too, so a signed-in user never sees a flash of the landing
// page before being redirected.
export default function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={STAFF_ROLES.includes(user.role) ? '/staff' : '/dashboard'} replace />;
  }

  return <LandingPage />;
}
