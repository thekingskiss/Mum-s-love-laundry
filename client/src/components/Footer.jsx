import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin, Phone, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { SHOP_ADDRESS, SHOP_EMAIL, SHOP_PHONE } from '../lib/shopInfo.js';
import mllLogo from '../assets/mll-logo.png';

const SOCIALS = [Facebook, Instagram, X];

const CONTACTS = [
  { key: 'address', label: 'address', Icon: MapPin, text: SHOP_ADDRESS },
  { key: 'phone', label: 'phone number', Icon: Phone, text: SHOP_PHONE, href: `tel:${SHOP_PHONE.replace(/[^\d+]/g, '')}` },
  { key: 'email', label: 'email', Icon: Mail, text: SHOP_EMAIL, href: `mailto:${SHOP_EMAIL}` },
];

// Only the icons show. Tapping one reveals that detail alone; tapping anywhere
// else on the page (or pressing Escape) puts it away again.
function ContactIcons() {
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    if (!openKey) return undefined;
    // Closing waits a tick so a tap on the phone or email link still follows it.
    const close = (event) => {
      if (event.target.closest?.('[data-contact-toggle]')) return;
      setTimeout(() => setOpenKey(null), 0);
    };
    const onKey = (event) => event.key === 'Escape' && setOpenKey(null);
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [openKey]);

  const open = CONTACTS.find((c) => c.key === openKey);

  return (
    <div className="mt-2 md:mt-4">
      <div className="flex gap-2 md:gap-3">
        {CONTACTS.map(({ key, label, Icon }) => {
          const active = key === openKey;
          return (
            <button
              key={key}
              type="button"
              data-contact-toggle
              aria-label={`Show our ${label}`}
              aria-expanded={active}
              aria-controls="footer-contact-detail"
              onClick={() => setOpenKey(active ? null : key)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                active
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-slate-200 text-brand-500 hover:border-brand-400 dark:border-slate-700'
              }`}
            >
              <Icon size={17} />
            </button>
          );
        })}
      </div>
      <div id="footer-contact-detail" aria-live="polite" className="text-xs md:text-sm">
        {open && (
          <p className="mt-3 rounded-lg bg-white px-3 py-2 text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
            {open.href ? (
              <a href={open.href} className="font-medium hover:text-brand-600">
                {open.text}
              </a>
            ) : (
              open.text
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-slate-100 bg-slate-50/90 text-slate-500 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-6 px-5 py-8 md:grid-cols-4 md:gap-10 md:px-6 md:py-16">
        <div className="col-span-2 md:col-span-1">
          <img src={mllLogo} alt="Mum's Love Laundry" className="h-8 w-auto md:h-10" />
          <p className="mt-2 text-xs md:mt-4 md:text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t('footer_tagline')}
          </p>
          <div className="mt-3 flex gap-2 md:mt-5 md:gap-3">
            {SOCIALS.map((Icon, i) => (
              <span
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 md:h-9 md:w-9 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700"
              >
                <Icon size={15} />
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-display text-base text-ink-900 dark:text-white md:text-lg">{t('footer_company')}</h4>
          <ul className="mt-2 space-y-1.5 text-xs md:mt-4 md:space-y-2.5 md:text-sm">
            <li><Link to="/" className="hover:text-brand-600">{t('nav_home')}</Link></li>
            <li><Link to="/about" className="hover:text-brand-600">{t('nav_about')}</Link></li>
            <li><Link to="/blog" className="hover:text-brand-600">{t('nav_blog')}</Link></li>
            <li><Link to="/contact" className="hover:text-brand-600">{t('nav_contact')}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-base text-ink-900 dark:text-white md:text-lg">{t('footer_services')}</h4>
          <ul className="mt-2 space-y-1.5 text-xs md:mt-4 md:space-y-2.5 md:text-sm">
            <li><Link to="/services" className="hover:text-brand-600">Washing Only</Link></li>
            <li><Link to="/services" className="hover:text-brand-600">Ironing Only</Link></li>
            <li><Link to="/services" className="hover:text-brand-600">Wash &amp; Iron</Link></li>
            <li><Link to="/pricing" className="hover:text-brand-600">Full Price List</Link></li>
          </ul>
        </div>

        <div className="col-span-2 md:col-span-1">
          <h4 className="font-display text-base text-ink-900 dark:text-white md:text-lg">{t('footer_contact_info')}</h4>
          <ContactIcons />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 border-t border-slate-200 px-5 py-3 text-center text-[11px] md:gap-2 md:py-6 md:text-xs text-slate-400 dark:border-slate-800 sm:flex-row sm:justify-between sm:px-6">
        <span>© {new Date().getFullYear()} Mum's Love Laundry. All rights reserved.</span>
        <span className="flex gap-4">
          <Link to="/privacy" className="hover:text-brand-600">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-brand-600">Terms of Service</Link>
        </span>
      </div>
    </footer>
  );
}
