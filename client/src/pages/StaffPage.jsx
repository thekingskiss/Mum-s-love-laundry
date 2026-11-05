import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  BookUser,
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
  Percent,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useBranch } from '../context/BranchContext.jsx';
import AdminOverview from '../components/AdminOverview.jsx';
import AuditLogTab from '../components/AuditLogTab.jsx';
import { ADMIN_ROLES } from '../lib/roles';
import { AnalyticsTab } from './staff/AnalyticsTab.jsx';
import { BranchesTab } from './staff/BranchesTab.jsx';
import { CapacityTab } from './staff/CapacityTab.jsx';
import { CustomersTab } from './staff/CustomersTab.jsx';
import { DashboardTab } from './staff/DashboardTab.jsx';
import { ExpensesTab } from './staff/ExpensesTab.jsx';
import { InventoryTab } from './staff/InventoryTab.jsx';
import { InvoicesTab } from './staff/InvoicesTab.jsx';
import { MessagesTab } from './staff/MessagesTab.jsx';
import { OrderQueueTab } from './staff/OrderQueueTab.jsx';
import { PaymentsTab } from './staff/PaymentsTab.jsx';
import { PricingTab } from './staff/PricingTab.jsx';
import { ScheduledPickupsTab } from './staff/ScheduledPickupsTab.jsx';
import { StaffTab } from './staff/StaffTab.jsx';
import { ZonesTab } from './staff/ZonesTab.jsx';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: Home, adminOnly: false },
  { key: 'orders', label: 'Orders', icon: ClipboardList, adminOnly: false },
  { key: 'customers', label: 'Customers', icon: BookUser, adminOnly: false },
  { key: 'messages', label: 'Messages', icon: Mail, adminOnly: false },
  { key: 'pickups', label: 'Scheduled Pickups', icon: CalendarCheck, adminOnly: true },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
  { key: 'payments', label: 'Payments', icon: Wallet, adminOnly: true },
  { key: 'invoices', label: 'Invoices', icon: FileText, adminOnly: false },
  { key: 'inventory', label: 'Inventory', icon: Boxes, adminOnly: true },
  { key: 'expenses', label: 'Expenses', icon: Receipt, adminOnly: true },
  { key: 'staff', label: 'Staff accounts', icon: Users, adminOnly: true },
  { key: 'branches', label: 'Branches', icon: Building2, adminOnly: true, superAdminOnly: true },
  { key: 'zones', label: 'Zones', icon: MapPin, adminOnly: true },
  { key: 'pricing', label: 'Pricing', icon: Percent, adminOnly: false },
  { key: 'capacity', label: 'Capacity', icon: CalendarDays, adminOnly: true },
  { key: 'audit', label: 'Audit log', icon: History, adminOnly: true, superAdminOnly: true },
];

export default function StaffPage() {
  return <Workspace area="staff" />;
}

// The tabs shared by the staff and admin workspaces. An admin on /staff is
// previewing the staff view, so they get what laundry staff get there.
export function Workspace({ area }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    branches,
    currentBranchId,
    setCurrentBranchId,
    isSuperAdmin,
  } = useBranch();

  const isAdmin = area === 'admin';
  const staffPreview = !isAdmin && ADMIN_ROLES.includes(user.role);
  const tabUser = staffPreview ? { ...user, role: 'laundry_staff' } : user;

  const [searchParams, setSearchParams] = useSearchParams();

  const requestedTab = searchParams.get('tab');
  const requestedTabConfig = TABS.find((item) => item.key === requestedTab);
  const canAccessTab = (config, inAdminArea) =>
    Boolean(config) &&
    (!config.adminOnly || inAdminArea) &&
    (!config.superAdminOnly || isSuperAdmin);

  const canOpenRequestedTab = canAccessTab(requestedTabConfig, isAdmin);
  const tab = canOpenRequestedTab ? requestedTab : 'dashboard';

  useEffect(() => {
    if (!requestedTab || canOpenRequestedTab) return;

    // Links saved before /admin existed, like /staff?tab=analytics.
    if (staffPreview && canAccessTab(requestedTabConfig, true)) {
      navigate(`/admin?tab=${requestedTab}`, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab, canOpenRequestedTab, staffPreview, isSuperAdmin]);

   return (
    <div className="w-full px-4 pb-16 pt-6 sm:px-6 md:px-0 md:pt-2">
      {staffPreview && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-900 dark:bg-violet-950/30">
          <p className="text-sm text-violet-900 dark:text-violet-200">
            <span className="font-semibold">You're previewing the staff view.</span> Anything you change here is real.
            Figures still cover your own access, not one staff member's.
          </p>
          <Link to="/admin" className="text-sm font-semibold text-violet-700 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100">
            Back to admin
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold text-ink-900 dark:text-white">
              {TABS.find((item) => item.key === tab).label}
            </h1>

            {isAdmin && (
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                {STAFF_ROLE_LABELS[user.role]}
              </span>
            )}
          </div>

          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Signed in as {user.full_name} {'\u00B7'}{' '}
            {STAFF_ROLE_LABELS[user.role] || user.role}
          </p>
        </div>

        {isSuperAdmin && branches.length > 0 && (
          <select
            value={currentBranchId}
            onChange={(e) =>
              setCurrentBranchId(e.target.value)
            }
            title="Filter the Dashboard, Order Queue, Scheduled Pickups, Invoices, Payments, and Analytics tabs by branch"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">All Branches</option>

            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-8">

        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{
                duration: 0.2,
                ease: 'easeOut',
              }}
            >
              {tab === 'dashboard' && (
                isAdmin ? <AdminOverview /> : <DashboardTab />
              )}

              {tab === 'orders' && (
                <OrderQueueTab user={tabUser} />
              )}

              {tab === 'customers' && (
                <CustomersTab />
              )}

              {tab === 'messages' && (
                <MessagesTab isAdmin={isAdmin} />
              )}

              {tab === 'pickups' && isAdmin && (
                <ScheduledPickupsTab />
              )}

              {tab === 'analytics' && isAdmin && (
                <AnalyticsTab />
              )}

              {tab === 'payments' && isAdmin && (
                <PaymentsTab />
              )}

              {tab === 'invoices' && (
                <InvoicesTab />
              )}

              {tab === 'inventory' && isAdmin && (
                <InventoryTab />
              )}

              {tab === 'expenses' && isAdmin && (
                <ExpensesTab />
              )}

              {tab === 'staff' && isAdmin && (
                <StaffTab user={user} />
              )}

              {tab === 'branches' && isAdmin && isSuperAdmin && (
                <BranchesTab />
              )}

              {tab === 'audit' && isAdmin && isSuperAdmin && (
                <AuditLogTab />
              )}

              {tab === 'zones' && isAdmin && (
                <ZonesTab />
              )}

              {tab === 'pricing' && (
                <PricingTab canEdit={isAdmin} />
              )}

              {tab === 'capacity' && isAdmin && (
                <CapacityTab />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const STAFF_ROLE_LABELS = {
  laundry_staff: 'Laundry Staff',
  administrator: 'Administrator',
  super_admin: 'Super Admin',
};
