import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin, Phone, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { SHOP_ADDRESS, SHOP_EMAIL, SHOP_PHONE } from '../lib/shopInfo.js';
import mllLogo from '../assets/mll-logo.png';

const SOCIALS = [Facebook, Instagram, X];

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-16 md:grid-cols-4">
        <div>
          <img src={mllLogo} alt="Mum's Love Laundry" className="h-10 w-auto" />
          <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t('footer_tagline')}
          </p>
          <div className="mt-5 flex gap-3">
            {SOCIALS.map((Icon, i) => (
              <span
                key={i}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700"
              >
                <Icon size={15} />
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-display text-lg text-ink-900 dark:text-white">{t('footer_company')}</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/" className="hover:text-brand-600">{t('nav_home')}</Link></li>
            <li><Link to="/about" className="hover:text-brand-600">{t('nav_about')}</Link></li>
            <li><Link to="/blog" className="hover:text-brand-600">{t('nav_blog')}</Link></li>
            <li><Link to="/contact" className="hover:text-brand-600">{t('nav_contact')}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-lg text-ink-900 dark:text-white">{t('footer_services')}</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/services" className="hover:text-brand-600">Washing Only</Link></li>
            <li><Link to="/services" className="hover:text-brand-600">Ironing Only</Link></li>
            <li><Link to="/services" className="hover:text-brand-600">Wash &amp; Iron</Link></li>
            <li><Link to="/pricing" className="hover:text-brand-600">Full Price List</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-lg text-ink-900 dark:text-white">{t('footer_contact_info')}</h4>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-brand-500" /> {SHOP_ADDRESS}</li>
            <li className="flex items-start gap-2"><Phone size={16} className="mt-0.5 shrink-0 text-brand-500" /> {SHOP_PHONE}</li>
            <li className="flex items-start gap-2"><Mail size={16} className="mt-0.5 shrink-0 text-brand-500" /> {SHOP_EMAIL}</li>
          </ul>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 border-t border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800 sm:flex-row sm:justify-between sm:px-6">
        <span>© {new Date().getFullYear()} Mum's Love Laundry. All rights reserved.</span>
        <span className="flex gap-4">
          <Link to="/privacy" className="hover:text-brand-600">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-brand-600">Terms of Service</Link>
        </span>
      </div>
    </footer>
  );
}
