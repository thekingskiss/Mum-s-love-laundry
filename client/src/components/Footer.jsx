import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin, Phone, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { SHOP_ADDRESS, SHOP_EMAIL, SHOP_PHONE } from '../lib/shopInfo.js';
import mllLogo from '../assets/mll-logo.png';

const SOCIALS = [Facebook, Instagram, X];

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
          <ul className="mt-2 space-y-1.5 text-xs md:mt-4 md:space-y-3 md:text-sm">
            <li className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-brand-500" /> {SHOP_ADDRESS}</li>
            <li className="flex items-start gap-2"><Phone size={16} className="mt-0.5 shrink-0 text-brand-500" /> {SHOP_PHONE}</li>
            <li className="flex items-start gap-2"><Mail size={16} className="mt-0.5 shrink-0 text-brand-500" /> {SHOP_EMAIL}</li>
          </ul>
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
