import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  History,
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
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useBranch } from '../context/BranchContext.jsx';
import { ADMIN_ROLES, STAFF_ROLES, workspacePath } from '../lib/roles';

const BADGE_REFRESH_MS = 60_000;

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
    label: 'Pricing',
    to: '/dashboard?tab=pricing',
    icon: Percent,
  },
  {
    label: 'My Orders',
    to: '/dashboard?tab=orders',
    icon: ClipboardList,
  },
  {
    label: 'Payments',
    to: '/dashboard?tab=payments',
    icon: Wallet,
  },
  {
    label: 'Notifications',
    to: '/dashboard?tab=notifications',
    icon: Bell,
  },
];

const dashboardItem = { label: 'Dashboard', tab: null, icon: Home };

const staffItems = [
  dashboardItem,
  { label: 'Orders', tab: 'orders', icon: ClipboardList },
  { label: 'Customers', tab: 'customers', icon: Users },
  { label: 'Messages', tab: 'messages', icon: Mail },
  { label: 'Invoices', tab: 'invoices', icon: FileText },
  { label: 'Pricing', tab: 'pricing', icon: Percent },
];

// badge names a field of GET /admin/overview. Opening one group closes the
// others, which keeps the whole list on screen without scrolling.
const adminGroups = [
  {
    label: 'Operations',
    items: [
      { label: 'Orders', tab: 'orders', icon: ClipboardList },
      { label: 'Customers', tab: 'customers', icon: Users },
      { label: 'Messages', tab: 'messages', icon: Mail, badge: 'unread_messages' },
      { label: 'Invoices', tab: 'invoices', icon: FileText },
      { label: 'Scheduled Pickups', tab: 'pickups', icon: CalendarCheck, badge: 'overdue_pickups' },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Analytics', tab: 'analytics', icon: BarChart3 },
      { label: 'Payments', tab: 'payments', icon: Wallet },
      { label: 'Expenses', tab: 'expenses', icon: Receipt },
      { label: 'Inventory', tab: 'inventory', icon: Boxes, badge: 'low_stock_count' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Branches', tab: 'branches', icon: Building2, superAdminOnly: true },
      { label: 'Pricing', tab: 'pricing', icon: Percent },
      { label: 'Staff accounts', tab: 'staff', icon: Users },
      { label: 'Zones', tab: 'zones', icon: MapPin },
      { label: 'Capacity', tab: 'capacity', icon: CalendarDays },
      { label: 'Audit log', tab: 'audit', icon: History, superAdminOnly: true },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
];

function CountBadge({ count, compact }) {
  if (!count) return null;
  const text = count > 99 ? '99+' : count;

  if (compact) {
    return (
      <span
        aria-label={`${count} need attention`}
        className="absolute end-1 top-1 h-2 w-2 rounded-full bg-red-500"
      />
    );
  }

  return (
    <span className="ms-auto shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-red-700 dark:bg-red-950/60 dark:text-red-300">
      {text}
    </span>
  );
}

function SidebarButton({ item, active, showLabels, badge, adminAccent, onClick }) {
  const Icon = item.icon;
  const activeClass = adminAccent
    ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
    : 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400';

  return (
    <button
      type="button"
      onClick={onClick}
      title={!showLabels ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={[
        'group relative flex w-full items-center rounded-xl px-3 text-start text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
        adminAccent ? 'py-2' : 'py-2.5',
        showLabels ? 'gap-3' : 'justify-center',
        active
          ? activeClass
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
      ].join(' ')}
    >
      <Icon className="h-5 w-5 shrink-0" />

      {showLabels && (
        <span className="truncate">{item.label}</span>
      )}

      <CountBadge count={badge} compact={!showLabels} />
    </button>
  );
}

function AdminNav({ isSuperAdmin, showLabels, onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentBranchId } = useBranch();
  const [figures, setFigures] = useState(null);

  // location.search is a dependency so a badge updates after acting on it.
  useEffect(() => {
    let cancelled = false;

    function load() {
      api
        .get('/admin/overview', { params: { branch_id: currentBranchId || undefined } })
        .then(({ data }) => {
          if (!cancelled) setFigures(data);
        })
        .catch(() => {});
    }

    load();
    const interval = setInterval(load, BADGE_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentBranchId, location.search]);

  const currentTab = new URLSearchParams(location.search).get('tab');
  const isActive = (item) => {
    if (item.to) return location.pathname === item.to;
    if (location.pathname !== '/admin') return false;
    return item.tab === null ? !currentTab || currentTab === 'dashboard' : currentTab === item.tab;
  };

  const groups = adminGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.superAdminOnly || isSuperAdmin),
  }));
  const activeGroup = groups.find((group) => group.items.some(isActive))?.label;

  const [openGroup, setOpenGroup] = useState(activeGroup ?? groups[0].label);

  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup]);

  const badgeFor = (item) => (item.badge ? figures?.[item.badge] : 0);

  function renderItem(item) {
    return (
      <SidebarButton
        key={item.label}
        item={item}
        active={isActive(item)}
        showLabels={showLabels}
        badge={badgeFor(item)}
        adminAccent
        onClick={() => {
          onNavigate();
          if (item.to) navigate(item.to);
          else navigate(item.tab === null ? '/admin' : `/admin?tab=${encodeURIComponent(item.tab)}`);
        }}
      />
    );
  }

  return (
    <>
      {renderItem(dashboardItem)}

      {groups.map((group) => {
        const open = !showLabels || openGroup === group.label;
        const hiddenCount = group.items.reduce((sum, item) => sum + (badgeFor(item) || 0), 0);

        return (
          <div key={group.label} className="mt-1.5">
            {showLabels ? (
              <button
                type="button"
                onClick={() => setOpenGroup(open ? null : group.label)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <span>{group.label}</span>
                {!open && <CountBadge count={hiddenCount} />}
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${open ? 'rotate-180' : ''} ${!open && hiddenCount ? '' : 'ms-auto'}`} />
              </button>
            ) : (
              <div className="mx-3 mb-2 h-px bg-slate-200 dark:bg-slate-800" />
            )}

            {open && (
              <div className="space-y-0.5">
                {group.items.map(renderItem)}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

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

  // An admin on /staff is previewing the staff view, so they get its navigation.
  const staffPreview = isAdmin && location.pathname === '/staff';
  const adminView = isAdmin && !staffPreview;

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
    navigate(workspacePath(role));
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

  function isCustomerItemActive(to) {
    const target = new URL(to, window.location.origin);

    return (
      location.pathname === target.pathname &&
      new URLSearchParams(location.search).get('tab') ===
        target.searchParams.get('tab')
    );
  }

  const sidebarWidth =
    collapsed && !mobileOpen ? 'md:w-20' : 'md:w-72';

  // Admins have the longest menu, so their bottom actions share one row.
  const actionsInRow = adminView && showLabels;

  return (
    <>
      {/* Mobile menu button */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed start-4 top-4 z-40 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-lg transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
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
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-slate-200 bg-white shadow-xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900',
          'md:sticky md:top-0 md:z-30 md:h-screen',
          sidebarWidth,
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full rtl:translate-x-full md:translate-x-0 md:rtl:translate-x-0',
        ].join(' ')}
        aria-label="Dashboard navigation"
      >
        {/* Logo */}
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
          {showLabels ? (
            <button
              type="button"
              onClick={handleLogoNavigation}
              className="flex min-w-0 items-center gap-3 rounded-xl text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
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
          className={`flex-1 overflow-y-auto px-3 ${adminView ? 'py-2' : 'py-5'}`}
          aria-label={adminView ? 'Admin workspace' : isStaff ? 'Staff workspace' : 'My account'}
        >
          {showLabels && !adminView && (
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {isStaff ? 'Operations' : 'My Account'}
            </p>
          )}

          {adminView ? (
            <AdminNav
              isSuperAdmin={isSuperAdmin}
              showLabels={showLabels}
              onNavigate={closeMobileMenu}
            />
          ) : isStaff ? (
            <div className="space-y-1">
              {staffItems.map((item) => (
                <SidebarButton
                  key={item.label}
                  item={item}
                  active={isStaffItemActive(item.tab)}
                  showLabels={showLabels}
                  onClick={() => handleStaffNavigation(item.tab)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {customerItems.map((item) => {
                const Icon = item.icon;
                const active = isCustomerItemActive(item.to);

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={closeMobileMenu}
                    title={!showLabels ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
                      showLabels
                        ? 'gap-3'
                        : 'justify-center',
                      active
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5 shrink-0" />

                    {showLabels && (
                      <span className="truncate">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Bottom actions */}
        <div
          className={[
            'shrink-0 border-t border-slate-100 dark:border-slate-800',
            actionsInRow ? 'flex items-center gap-1 p-2' : 'p-3',
          ].join(' ')}
        >
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                navigate(staffPreview ? '/admin' : '/staff');
              }}
              title={!showLabels ? (staffPreview ? 'Back to admin' : 'Open staff view') : undefined}
              className={[
                'flex items-center rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:text-slate-300 dark:hover:bg-violet-950/30 dark:hover:text-violet-300',
                actionsInRow ? 'min-w-0 flex-1 gap-2 whitespace-nowrap' : 'mb-1 w-full',
                !showLabels && 'justify-center',
                showLabels && !actionsInRow && 'gap-3',
              ].filter(Boolean).join(' ')}
            >
              <ArrowLeftRight className="h-5 w-5 shrink-0" />

              {showLabels && <span>{staffPreview ? 'Back to admin' : 'Open staff view'}</span>}
            </button>
          )}

          {!adminView && (
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
          )}

          <button
            type="button"
            onClick={handleLogout}
            title={!showLabels || actionsInRow ? 'Log out' : undefined}
            aria-label="Log out"
            className={[
              'flex items-center rounded-xl py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-400',
              actionsInRow ? 'shrink-0 px-2.5' : 'w-full px-3',
              showLabels ? 'gap-3' : 'justify-center',
            ].join(' ')}
          >
            <LogOut className="h-5 w-5 shrink-0" />

            {showLabels && !actionsInRow && <span>Log out</span>}
          </button>

          {/* Desktop collapse button */}
          <button
            type="button"
            onClick={() =>
              setCollapsed((value) => !value)
            }
            className={[
              'hidden items-center justify-center rounded-xl border border-slate-200 py-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:flex',
              actionsInRow ? 'shrink-0 px-2' : 'mt-2 w-full',
            ].join(' ')}
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