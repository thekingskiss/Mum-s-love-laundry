import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  History,
  Home,
  Mail,
  MapPin,
  Package,
  Percent,
  Plus,
  Receipt,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { ADMIN_ROLES, STAFF_ROLES } from './roles';

// The navigation for every workspace, in one place. The desktop sidebar and the
// phone tab bar both read from here, so a page added to one can't go missing
// from the other.

export const customerItems = [
  { label: 'Dashboard', to: '/dashboard', icon: Home },
  { label: 'Book an Order', to: '/book', icon: Package },
  { label: 'Pricing', to: '/dashboard?tab=pricing', icon: Percent },
  { label: 'My Orders', to: '/dashboard?tab=orders', icon: ClipboardList },
  { label: 'Payments', to: '/dashboard?tab=payments', icon: Wallet },
  { label: 'Notifications', to: '/dashboard?tab=notifications', icon: Bell },
];

export const dashboardItem = { label: 'Dashboard', tab: null, icon: Home };

export const staffItems = [
  dashboardItem,
  { label: 'Orders', tab: 'orders', icon: ClipboardList },
  { label: 'Customers', tab: 'customers', icon: Users },
  { label: 'Messages', tab: 'messages', icon: Mail },
  { label: 'Invoices', tab: 'invoices', icon: FileText },
  { label: 'Pricing', tab: 'pricing', icon: Percent },
];

// badge names a field of GET /admin/overview. Opening one group closes the
// others, which keeps the whole list on screen without scrolling.
export const adminGroups = [
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

// ---------------------------------------------------------------------------
// Phone navigation: four tabs (the most used pages) plus a "More" sheet that
// holds everything else.
// ---------------------------------------------------------------------------

const withTab = (base, tab) => (tab ? `${base}?tab=${encodeURIComponent(tab)}` : base);

/** Resolves a sidebar-style item ({ tab } or { to }) to a URL inside a workspace. */
function resolve(base, item) {
  return { ...item, to: item.to ?? withTab(base, item.tab) };
}

/**
 * The phone navigation for a role.
 *
 *   kind     which workspace this is ('customer' | 'staff' | 'admin')
 *   tabs     up to four bottom-bar entries; one may be `primary` (the raised Book button)
 *   groups   sections of the More sheet
 *
 * An administrator on /staff is previewing the staff view, so they get the
 * staff navigation (with a way back).
 */
export function phoneNav({ role, pathname = '', isSuperAdmin = role === 'super_admin' }) {
  const isAdmin = ADMIN_ROLES.includes(role);
  const isStaff = STAFF_ROLES.includes(role);

  if (isAdmin && pathname !== '/staff') {
    const groups = adminGroups.map((group) => ({
      label: group.label,
      items: group.items.filter((item) => !item.superAdminOnly || isSuperAdmin).map((item) => resolve('/admin', item)),
    }));
    return {
      kind: 'admin',
      home: '/admin',
      tabs: [
        { label: 'Overview', to: '/admin', icon: Home },
        { label: 'Orders', to: '/admin?tab=orders', icon: ClipboardList },
        { label: 'Messages', to: '/admin?tab=messages', icon: Mail, badge: 'unread_messages' },
        { label: 'Payments', to: '/admin?tab=payments', icon: Wallet },
      ],
      groups,
      switchTo: { label: 'Open staff view', to: '/staff' },
    };
  }

  if (isStaff) {
    return {
      kind: 'staff',
      home: '/staff',
      tabs: [
        { label: 'Home', to: '/staff', icon: Home },
        { label: 'Orders', to: '/staff?tab=orders', icon: ClipboardList },
        { label: 'Customers', to: '/staff?tab=customers', icon: Users },
        { label: 'Messages', to: '/staff?tab=messages', icon: Mail },
      ],
      groups: [
        {
          label: 'Workspace',
          items: [
            resolve('/staff', { label: 'Invoices', tab: 'invoices', icon: FileText }),
            resolve('/staff', { label: 'Pricing', tab: 'pricing', icon: Percent }),
            { label: 'Settings', to: '/settings', icon: Settings },
          ],
        },
      ],
      switchTo: isAdmin ? { label: 'Back to admin', to: '/admin' } : null,
    };
  }

  return {
    kind: 'customer',
    home: '/dashboard',
    tabs: [
      { label: 'Home', to: '/dashboard', icon: Home },
      { label: 'Orders', to: '/dashboard?tab=orders', icon: ClipboardList },
      { label: 'Book', to: '/book', icon: Plus, primary: true },
      { label: 'Payments', to: '/dashboard?tab=payments', icon: Wallet },
    ],
    groups: [
      {
        label: 'My account',
        items: [
          { label: 'Pricing', to: '/dashboard?tab=pricing', icon: Percent },
          { label: 'Notifications', to: '/dashboard?tab=notifications', icon: Bell },
          { label: 'Settings', to: '/settings', icon: Settings },
        ],
      },
    ],
    switchTo: null,
  };
}

/** Whether a nav item's URL is the page currently shown. */
export function isNavItemActive(to, location) {
  const target = new URL(to, 'http://local');
  if (location.pathname !== target.pathname) return false;

  const wanted = target.searchParams.get('tab');
  const current = new URLSearchParams(location.search).get('tab');
  // A workspace's home page is its URL with no tab, or an explicit dashboard tab.
  if (!wanted) return !current || current === 'dashboard';
  return wanted === current;
}
