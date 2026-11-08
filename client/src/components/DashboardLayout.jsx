import { Outlet } from 'react-router-dom';
import DashboardSidebar from './DashboardSidebar.jsx';
import MobileShell from './MobileShell.jsx';
import { useIsDesktop } from '../lib/useMediaQuery.js';

// Phones get an app-style shell (top bar, bottom tabs); wider screens keep the sidebar.
export default function DashboardLayout() {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <MobileShell>
        <Outlet />
      </MobileShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="grid min-h-screen grid-cols-[auto_minmax(0,1fr)]">
        <DashboardSidebar />

        <main className="min-h-screen min-w-0">
          <div className="mx-auto w-full max-w-[1600px] px-6 py-8 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
