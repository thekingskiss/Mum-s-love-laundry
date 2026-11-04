import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Package,
  Percent,
  Receipt,
  Settings,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const ADMIN_ROLES = ['administrator', 'super_admin'];
const STAFF_ROLES = ['laundry_staff', 'administrator', 'super_admin'];

const customerItems = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: Home,
  },
  {
    label: 'Book an Order',
    to: '/book',
    icon: Package,
  },
  {
    label: 'My Orders',
    to: '/dashboard',
    icon: ClipboardList,
  },
  {
    label: 'Payments',
    to: '/dashboard',
    icon: Wallet,
  },
  {
    label: 'Notifications',
    to: '/dashboard',
    icon: Bell,
  },
];

const staffItems = [
  // General staff navigation
  {
    label: 'Dashboard',
    tab: null,
    icon: Home,
  },
  {
    label: 'Orders',
    tab: 'orders',
    icon: ClipboardList,
  },
  {
    label: 'Customers',
    tab: 'customers',
    icon: Users,
  },
  {
    label: 'Messages',
    tab: 'messages',
    icon: Mail,
  },
  {
    label: 'Invoices',
    tab: 'invoices',
    icon: FileText,
  },

  // Administrator / Super Administrator
  {
    label: 'Scheduled Pickups',
    tab: 'pickups',
    icon: CalendarCheck,
    adminOnly: true,
  },
  {
    label: 'Analytics',
    tab: 'analytics',
    icon: BarChart3,
    adminOnly: true,
  },
  {
    label: 'Payments',
    tab: 'payments',
    icon: Wallet,
    adminOnly: true,
  },
  {
    label: 'Inventory',
    tab: 'inventory',
    icon: Boxes,
    adminOnly: true,
  },
  {
    label: 'Expenses',
    tab: 'expenses',
    icon: Receipt,
    adminOnly: true,
  },
  {
    label: 'Staff',
    tab: 'staff',
    icon: Users,
    adminOnly: true,
  },
  {
    label: 'Branches',
    tab: 'branches',
    icon: Building2,
    adminOnly: true,
    superAdminOnly: true,
  },
  {
    label: 'Zones',
    tab: 'zones',
    icon: MapPin,
    adminOnly: true,
  },
  {
    label: 'Pricing',
    tab: 'pricing',
    icon: Percent,
    adminOnly: true,
  },
  {
    label: 'Capacity',
    tab: 'capacity',
    icon: CalendarDays,
    adminOnly: true,
  },
];

export default function DashboardSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role;

  const isStaff = STAFF_ROLES.includes(role);
  const isAdmin = ADMIN_ROLES.includes(role);
  const isSuperAdmin = role === 'super_admin';

  const visibleStaffItems = staffItems.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.superAdminOnly || isSuperAdmin)
  );

  const generalStaffItems = visibleStaffItems.filter(
    (item) => !item.adminOnly
  );

  const adminStaffItems = visibleStaffItems.filter(
    (item) => item.adminOnly
  );

  const firstName =
    user?.full_name?.trim()?.split(/\s+/)[0] ||
    user?.name?.trim()?.split(/\s+/)[0] ||
    'User';

  /*
   * Labels should always be visible on mobile.
   * On desktop they disappear only when the sidebar is collapsed.
   */
  const showLabels = !collapsed || mobileOpen;

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  function handleLogout() {
    closeMobileMenu();
    logout();
    navigate('/login', { replace: true });
  }

  function handleLogoNavigation() {
    closeMobileMenu();
    navigate(isStaff ? '/staff' : '/dashboard');
  }

  function handleStaffNavigation(tab) {
    closeMobileMenu();

    if (tab === null) {
      navigate('/staff');
      return;
    }

    navigate(`/staff?tab=${encodeURIComponent(tab)}`);
  }

  function isStaffItemActive(tab) {
    if (location.pathname !== '/staff') {
      return false;
    }

    const currentTab = new URLSearchParams(
      location.search
    ).get('tab');

    if (tab === null) {
      return !currentTab;
    }

    return currentTab === tab;
  }

  const sidebarWidth =
    collapsed && !mobileOpen ? 'md:w-20' : 'md:w-72';

  function renderStaffItem(item) {
    const Icon = item.icon;
    const active = isStaffItemActive(item.tab);

    return (
      <button
        key={item.label}
        type="button"
        onClick={() => handleStaffNavigation(item.tab)}
        title={!showLabels ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={[
          'group flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
          showLabels ? 'gap-3' : 'justify-center',
          active
            ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
        ].join(' ')}
      >
        <Icon className="h-5 w-5 shrink-0" />

        {showLabels && (
          <span className="truncate">{item.label}</span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* Mobile menu button */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed left-4 top-4 z-40 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-lg transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
          aria-label="Open dashboard menu"
          aria-expanded={false}
          aria-controls="dashboard-sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close dashboard menu"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-slate-950/40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        id="dashboard-sidebar"
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white shadow-xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900',
          'md:sticky md:top-0 md:z-30 md:h-screen',
          sidebarWidth,
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        aria-label="Dashboard navigation"
      >
        {/* Logo */}
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
          {showLabels ? (
            <button
              type="button"
              onClick={handleLogoNavigation}
              className="flex min-w-0 items-center gap-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              aria-label={
                isStaff
                  ? "Go to Mum's Love staff dashboard"
                  : "Go to Mum's Love customer dashboard"
              }
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white">
                M
              </div>

              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-ink-900 dark:text-white">
                  Mum's Love
                </p>

                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Laundry
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogoNavigation}
              className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              aria-label="Go to dashboard"
            >
              M
            </button>
          )}

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              setCollapsed(false);
            }}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:hidden"
            aria-label="Close dashboard menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User */}
        <div className="shrink-0 border-b border-slate-100 p-4 dark:border-slate-800">
          <div
            className={[
              'flex items-center',
              showLabels ? 'gap-3' : 'justify-center',
            ].join(' ')}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
              <UserRound className="h-5 w-5" />
            </div>

            {showLabels && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {firstName}
                </p>

                <p className="truncate text-xs capitalize text-slate-400 dark:text-slate-500">
                  {role?.replace(/_/g, ' ') || 'Customer'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-5"
          aria-label={isStaff ? 'Staff workspace' : 'My account'}
        >
          {showLabels && (
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {isStaff ? 'Staff Workspace' : 'My Account'}
            </p>
          )}

          {isStaff ? (
            <>
              <div className="space-y-1">
                {generalStaffItems.map(renderStaffItem)}
              </div>

              {adminStaffItems.length > 0 && (
                <div className="mt-6">
                  {showLabels && (
                    <div className="mb-2 px-3">
                      <div className="h-px bg-slate-200 dark:bg-slate-800" />

                      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        Admin
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    {adminStaffItems.map(renderStaffItem)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-1">
              {customerItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    onClick={closeMobileMenu}
                    title={!showLabels ? item.label : undefined}
                    className={({ isActive }) =>
                      [
                        'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
                        showLabels
                          ? 'gap-3'
                          : 'justify-center',
                        isActive
                          ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                      ].join(' ')
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />

                    {showLabels && (
                      <span className="truncate">
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="shrink-0 border-t border-slate-100 p-3 dark:border-slate-800">
          <NavLink
            to="/settings"
            onClick={closeMobileMenu}
            title={!showLabels ? 'Settings' : undefined}
            className={({ isActive }) =>
              [
                'mb-1 flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
                showLabels ? 'gap-3' : 'justify-center',
                isActive
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
              ].join(' ')
            }
          >
            <Settings className="h-5 w-5 shrink-0" />

            {showLabels && <span>Settings</span>}
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            title={!showLabels ? 'Log out' : undefined}
            className={[
              'flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-400',
              showLabels ? 'gap-3' : 'justify-center',
            ].join(' ')}
          >
            <LogOut className="h-5 w-5 shrink-0" />

            {showLabels && <span>Log out</span>}
          </button>

          {/* Desktop collapse button */}
          <button
            type="button"
            onClick={() =>
              setCollapsed((value) => !value)
            }
            className="mt-2 hidden w-full items-center justify-center rounded-xl border border-slate-200 py-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:flex"
            aria-label={
              collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}