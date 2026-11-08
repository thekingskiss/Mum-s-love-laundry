import { Navigate } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { workspacePath } from '../lib/roles';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading, connectionError, retrySession } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
      </div>
    );
  }

  // A saved login exists but the server couldn't be reached to confirm it.
  // That isn't a reason to send anyone to the login page.
  if (!user && connectionError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center" role="alert">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <WifiOff size={26} />
        </span>
        <h1 className="mt-4 font-display text-xl font-semibold text-ink-900 dark:text-white">Can't reach the server</h1>
        <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
          You're still signed in. Check your connection and we'll pick up where you left off.
        </p>
        <button
          type="button"
          onClick={retrySession}
          className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-brand-500 px-6 text-sm font-semibold text-white transition hover:bg-brand-600 active:scale-[0.98]"
        >
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={workspacePath(user.role)} replace />;
  return children;
}
