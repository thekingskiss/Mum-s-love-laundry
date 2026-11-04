import { Outlet } from 'react-router-dom';
import DashboardSidebar from './DashboardSidebar.jsx';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="md:grid md:min-h-screen md:grid-cols-[auto_minmax(0,1fr)]">
        <DashboardSidebar />

        <main className="min-h-screen min-w-0">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-6 pt-20 sm:px-6 md:py-8 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}