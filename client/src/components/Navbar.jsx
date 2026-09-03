import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock, LogOut, Menu, Moon, Phone, Settings, Sun, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import { SHOP_HOURS, SHOP_PHONE } from '../lib/shopInfo.js';
import mllLogo from '../assets/mll-logo.png';

const navLinkClass = ({ isActive }) =>
  `text-xs font-semibold uppercase tracking-widest transition-colors hover:text-brand-600 ${
    isActive ? 'text-brand-600' : 'text-slate-500 dark:text-slate-300'
  }`;

const STAFF_ROLES = ['laundry_staff', 'administrator', 'super_admin'];

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000');
function avatarSrc(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
}

export default function Navbar() {
  const { user, logout, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const isStaff = Boolean(user && STAFF_ROLES.includes(user.role));
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    setOpen(false);
    setProfileOpen(false);
    navigate('/');
  }

  function handleToggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    toggleTheme();
    if (user) {
      updateProfile({ theme_preference: next }).catch(() => {});
    }
  }

  useEffect(() => {
    if (!profileOpen) return undefined;
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm dark:bg-ink-900 dark:shadow-none dark:border-b dark:border-slate-800">
      {/* Utility bar */}
      <div className="hidden border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Clock size={13} /> {SHOP_HOURS}
          </span>
          <span className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Phone size={13} /> {SHOP_PHONE}
            </span>
            {!user && (
              <Link to="/login" className="font-semibold text-slate-600 hover:text-brand-600 dark:text-slate-300">
                {t('nav_login')}
              </Link>
            )}
          </span>
        </div>
      </div>

      {/* Main nav */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center">
          <img src={mllLogo} alt="Mum's Love Laundry" className="h-10 w-auto" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {!isStaff && (
            <>
              <NavLink to="/" className={navLinkClass} end>
                {t('nav_home')}
              </NavLink>
              <NavLink to="/about" className={navLinkClass}>
                {t('nav_about')}
              </NavLink>
              <NavLink to="/services" className={navLinkClass}>
                {t('nav_services')}
              </NavLink>
              <NavLink to="/pricing" className={navLinkClass}>
                {t('nav_pricing')}
              </NavLink>
              <NavLink to="/blog" className={navLinkClass}>
                {t('nav_blog')}
              </NavLink>
              <NavLink to="/contact" className={navLinkClass}>
                {t('nav_contact')}
              </NavLink>
            </>
          )}
          {user && !isStaff && (
            <NavLink to="/dashboard" className={navLinkClass}>
              {t('nav_dashboard')}
            </NavLink>
          )}
          {isStaff && (
            <NavLink to="/staff" className={navLinkClass}>
              {t('nav_dashboard')}
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <button
            onClick={handleToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user && <NotificationBell />}
          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600 dark:text-slate-300"
              >
                {user.avatar_url ? (
                  <img src={avatarSrc(user.avatar_url)} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/40">
                    <User size={14} />
                  </span>
                )}
                Hi, {user.full_name.split(' ')[0]}
                <ChevronDown size={14} className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -6 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-48 origin-top-right overflow-hidden rounded-lg border border-slate-100 bg-white py-1.5 shadow-soft dark:border-slate-700 dark:bg-slate-800"
                  >
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <Settings size={15} /> {t('nav_settings')}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <LogOut size={15} /> {t('nav_logout')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              to="/register"
              className="rounded-full border border-slate-200 px-5 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300"
            >
              {t('nav_signup')}
            </Link>
          )}
          <Link
            to="/book"
            className="rounded-full bg-brand-500 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-soft transition hover:bg-brand-600"
          >
            {t('nav_order')}
          </Link>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          {user && <NotificationBell />}
          <button
            className="text-slate-700 dark:text-slate-200"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle navigation menu"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-ink-900 md:hidden"
          >
          <div className="flex flex-col gap-4 px-6 py-4">
            {!isStaff && (
              <>
                <NavLink to="/" className={navLinkClass} end onClick={() => setOpen(false)}>
                  {t('nav_home')}
                </NavLink>
                <NavLink to="/about" className={navLinkClass} onClick={() => setOpen(false)}>
                  {t('nav_about')}
                </NavLink>
                <NavLink to="/services" className={navLinkClass} onClick={() => setOpen(false)}>
                  {t('nav_services')}
                </NavLink>
                <NavLink to="/pricing" className={navLinkClass} onClick={() => setOpen(false)}>
                  {t('nav_pricing')}
                </NavLink>
                <NavLink to="/blog" className={navLinkClass} onClick={() => setOpen(false)}>
                  {t('nav_blog')}
                </NavLink>
                <NavLink to="/contact" className={navLinkClass} onClick={() => setOpen(false)}>
                  {t('nav_contact')}
                </NavLink>
                <NavLink to="/book" className={navLinkClass} onClick={() => setOpen(false)}>
                  Book a Drop-off
                </NavLink>
              </>
            )}
            {user && !isStaff && (
              <NavLink to="/dashboard" className={navLinkClass} onClick={() => setOpen(false)}>
                {t('nav_dashboard')}
              </NavLink>
            )}
            {isStaff && (
              <NavLink to="/staff" className={navLinkClass} onClick={() => setOpen(false)}>
                {t('nav_dashboard')}
              </NavLink>
            )}
            {user && (
              <NavLink to="/settings" className={navLinkClass} onClick={() => setOpen(false)}>
                {t('nav_settings')}
              </NavLink>
            )}
            <hr className="border-slate-100 dark:border-slate-800" />
            <button
              onClick={handleToggleTheme}
              className="flex items-center gap-2.5 text-left text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            {user ? (
              <button onClick={handleLogout} className="text-left text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
                {t('nav_logout')}
              </button>
            ) : (
              <>
                <Link to="/login" className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300" onClick={() => setOpen(false)}>
                  {t('nav_login')}
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-brand-500 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-white"
                  onClick={() => setOpen(false)}
                >
                  {t('nav_signup')}
                </Link>
              </>
            )}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
