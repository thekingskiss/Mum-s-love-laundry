import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { ArrowLeftRight, Download, LogOut, MoreHorizontal, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useBranch } from '../context/BranchContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { avatarSrc, initialsOf } from '../lib/avatar.js';
import { isNavItemActive, phoneNav } from '../lib/dashboardNav.js';
import { useInstall } from '../lib/pwa.js';
import { isDarkTheme } from '../lib/themes.js';
import { useAdminFigures } from '../lib/useAdminFigures.js';
import { IosInstallSteps } from './InstallPrompt.jsx';
import NotificationBell from './NotificationBell.jsx';

const ROLE_LABELS = {
  customer: 'Customer',
  laundry_staff: 'Laundry staff',
  administrator: 'Administrator',
  super_admin: 'Super admin',
};

// Administrators get a violet accent (as in the desktop sidebar) so it's always
// obvious which workspace you're in.
function accentFor(kind) {
  return kind === 'admin'
    ? { active: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300', label: 'text-violet-700 dark:text-violet-300' }
    : { active: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400', label: 'text-brand-600 dark:text-brand-400' };
}

function Avatar({ user, size = 'h-9 w-9' }) {
  const src = avatarSrc(user?.avatar_url);
  if (src) return <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  return (
    <span
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600 dark:bg-brand-950/60 dark:text-brand-300`}
    >
      {initialsOf(user?.full_name)}
    </span>
  );
}

function Badge({ count, className = '' }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} need attention`}
      className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function AppBar({ user, nav, onOpenMenu }) {
  const role = ROLE_LABELS[user?.role] || 'Customer';

  // The bar is solid on purpose: a backdrop-filter would make it the containing
  // block of the bell's fixed dropdown and trap the panel inside the bar.
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link
          to={nav.home}
          className="flex min-w-0 items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          aria-label="Mum's Love Laundry home"
        >
          <img src="/icons/icon-192.png" alt="" width="32" height="32" className="h-8 w-8 shrink-0 rounded-lg" />
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-bold leading-tight text-ink-900 dark:text-white">
              Mum's Love
            </span>
            {nav.kind !== 'customer' && (
              <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{role}</span>
            )}
          </span>
        </Link>

        <div className="ms-auto flex items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open account menu"
            className="flex h-11 w-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <Avatar user={user} />
          </button>
        </div>
      </div>
    </header>
  );
}

function TabBar({ nav, figures, location, moreOpen, onOpenMore, moreRef }) {
  const accent = accentFor(nav.kind);
  // The dot on More covers only what the tab bar doesn't already badge itself.
  const shownOnTabs = new Set(nav.tabs.map((tab) => tab.to));
  const hiddenAttention = nav.groups
    .flatMap((group) => group.items)
    .filter((item) => !shownOnTabs.has(item.to))
    .reduce((sum, item) => sum + (item.badge ? figures?.[item.badge] || 0 : 0), 0);
  const moreActive = nav.groups.some((group) => group.items.some((item) => isNavItemActive(item.to, location)))
    && !nav.tabs.some((tab) => isNavItemActive(tab.to, location));

  const cell =
    'relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-300';

  const tabItems = nav.tabs.map((tab) => {
    const Icon = tab.icon;
    const active = isNavItemActive(tab.to, location);
    const count = tab.badge ? figures?.[tab.badge] : 0;

    if (tab.primary) {
      return (
        <li key={tab.label} className="flex justify-center">
          <Link
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className="-mt-5 flex flex-col items-center gap-0.5 text-[11px] font-semibold text-brand-600 focus:outline-none dark:text-brand-400"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 ring-4 ring-white transition active:scale-95 dark:ring-slate-900">
              <Icon size={26} strokeWidth={2.5} />
            </span>
            {tab.label}
          </Link>
        </li>
      );
    }

    return (
      <li key={tab.label}>
        <Link
          to={tab.to}
          aria-current={active ? 'page' : undefined}
          onClick={() => active && window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`${cell} w-full ${active ? accent.label : 'text-slate-500 dark:text-slate-400'}`}
        >
          <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${active ? accent.active : ''}`}>
            <Icon size={21} strokeWidth={active ? 2.4 : 2} />
            <Badge count={count} className="absolute -end-0.5 -top-0.5" />
          </span>
          <span>{tab.label}</span>
        </Link>
      </li>
    );
  });

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 items-end">
        {tabItems}
        <li>
          <button
            ref={moreRef}
            type="button"
            onClick={onOpenMore}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`${cell} w-full ${moreActive || moreOpen ? accent.label : 'text-slate-500 dark:text-slate-400'}`}
          >
            <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${moreActive || moreOpen ? accent.active : ''}`}>
              <MoreHorizontal size={22} />
              {hiddenAttention > 0 && (
                <span aria-label={`${hiddenAttention} need attention`} className="absolute end-3 top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </span>
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function MoreSheet({ open, onClose, nav, figures, user, location }) {
  const navigate = useNavigate();
  const { logout, updateProfile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { canInstall, hasNativePrompt, ios, install } = useInstall();
  const dragControls = useDragControls();
  const sheetRef = useRef(null);
  const [showSteps, setShowSteps] = useState(false);
  const isDark = isDarkTheme(resolvedTheme);
  const accent = accentFor(nav.kind);

  // Escape closes, and the page behind must not scroll while the sheet is up.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  function handleTheme() {
    const next = toggleTheme();
    if (user) updateProfile({ theme_preference: next }).catch(() => {});
  }

  function handleLogout() {
    onClose();
    logout();
    navigate('/login', { replace: true });
  }

  const row =
    'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/50"
          />

          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => (info.offset.y > 90 || info.velocity.y > 500) && onClose()}
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] max-w-xl flex-col rounded-t-3xl bg-white shadow-2xl outline-none dark:bg-slate-900"
          >
            {/* Grab handle: the only part that drags, so the list inside still scrolls. */}
            <div
              onPointerDown={(event) => dragControls.start(event)}
              className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5"
            >
              <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-1">
              <Avatar user={user} size="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{user?.full_name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {ROLE_LABELS[user?.role] || 'Customer'}
                  {user?.email ? ` · ${user.email}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              {nav.groups.map((group) => (
                <section key={group.label} className="mb-4" aria-label={group.label}>
                  <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {group.label}
                  </h2>
                  <ul className="grid grid-cols-3 gap-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isNavItemActive(item.to, location);
                      const count = item.badge ? figures?.[item.badge] : 0;
                      return (
                        <li key={item.label}>
                          <Link
                            to={item.to}
                            onClick={onClose}
                            aria-current={active ? 'page' : undefined}
                            className={[
                              'relative flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-3 text-center text-xs font-medium leading-tight transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
                              active
                                ? `${accent.active} border-transparent`
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200',
                            ].join(' ')}
                          >
                            <Icon size={22} />
                            <span>{item.label}</span>
                            <Badge count={count} className="absolute end-2 top-2" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              <div className="space-y-0.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                {nav.switchTo && (
                  <Link to={nav.switchTo.to} onClick={onClose} className={row}>
                    <ArrowLeftRight size={19} className="text-slate-400" /> {nav.switchTo.label}
                  </Link>
                )}

                {canInstall && (
                  <>
                    <button
                      type="button"
                      onClick={() => (hasNativePrompt ? install().then(onClose) : setShowSteps((value) => !value))}
                      aria-expanded={hasNativePrompt ? undefined : showSteps}
                      className={row}
                    >
                      <Download size={19} className="text-slate-400" /> Install app
                    </button>
                    {showSteps && ios && <IosInstallSteps className="px-3 pb-2 pt-1" />}
                  </>
                )}

                <button type="button" onClick={handleTheme} className={row}>
                  {isDark ? <Sun size={19} className="text-slate-400" /> : <Moon size={19} className="text-slate-400" />}
                  {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className={`${row} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30`}
                >
                  <LogOut size={19} /> Log out
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * The phone version of the dashboard chrome: a slim app bar on top, a tab bar
 * at the bottom, and a "More" sheet for everything else. Pages render between.
 */
export default function MobileShell({ children }) {
  const { user } = useAuth();
  const { currentBranchId } = useBranch();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  const nav = useMemo(
    () => phoneNav({ role: user?.role, pathname: location.pathname }),
    [user?.role, location.pathname]
  );
  const figures = useAdminFigures({
    branchId: currentBranchId,
    refreshKey: location.search,
    enabled: nav.kind === 'admin',
  });

  // Moving to another page always leaves the sheet.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname, location.search]);

  const closeMore = () => {
    setMoreOpen(false);
    moreRef.current?.focus();
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppBar user={user} nav={nav} onOpenMenu={() => setMoreOpen(true)} />

      <main className="min-w-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2">{children}</main>

      <TabBar
        nav={nav}
        figures={figures}
        location={location}
        moreOpen={moreOpen}
        onOpenMore={() => setMoreOpen(true)}
        moreRef={moreRef}
      />
      <MoreSheet open={moreOpen} onClose={closeMore} nav={nav} figures={figures} user={user} location={location} />

    </div>
  );
}
