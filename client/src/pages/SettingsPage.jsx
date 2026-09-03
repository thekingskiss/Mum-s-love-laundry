import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, User } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { SUPPORTED_LANGUAGES } from '../lib/i18n';
import AvatarCropModal from '../components/AvatarCropModal.jsx';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000');

function avatarSrc(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
}

export default function SettingsPage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currencies, code: currencyCode, setCode: setCurrencyCode } = useCurrency();
  const { lang, setLang, t } = useLanguage();
  const toast = useToast();

  const [zones, setZones] = useState([]);
  const [form, setForm] = useState({
    username: user.username,
    full_name: user.full_name,
    phone_number: user.phone_number,
    location_zone: user.location_zone,
    date_of_birth: user.date_of_birth ? user.date_of_birth.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const fileInputRef = useRef(null);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: '', current_password: '' });
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    api.get('/zones').then(({ data }) => setZones(data.zones)).catch(() => setZones([]));
  }, []);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  // Profile edits, avatar uploads, and preference toggles are all action
  // results (not field-level validation), so they get a transient toast
  // rather than a persistent inline banner.
  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      // An empty date input is '' — the server expects either a real date
      // or an explicit null (to clear it), not an empty string.
      await updateProfile({ ...form, date_of_birth: form.date_of_birth || null });
      toast.success(t('settings_saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to save your changes.');
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCropFile(file);
  }

  async function handleCropSave(croppedFile) {
    setAvatarBusy(true);
    try {
      await uploadAvatar(croppedFile);
      setCropFile(null);
      toast.success('Profile picture updated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to upload that image.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handlePreferenceChange(field, value, applyLocal) {
    applyLocal(value);
    try {
      await updateProfile({ [field]: value });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to save that preference.');
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setEmailSaving(true);
    setEmailError('');
    try {
      await updateProfile(emailForm);
      toast.success('Email updated.');
      setShowEmailForm(false);
      setEmailForm({ email: '', current_password: '' });
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Unable to update your email.');
    } finally {
      setEmailSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-10">
      <h1 className="font-display text-3xl font-semibold text-ink-900 dark:text-white">{t('settings_title')}</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">{t('settings_subtitle')}</p>

      <div className="mt-8 flex items-center gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div className="relative">
          {user.avatar_url ? (
            <img src={avatarSrc(user.avatar_url)} alt={user.full_name} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/40">
              <User size={32} />
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarBusy}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white shadow-soft hover:bg-brand-600 disabled:opacity-60"
            aria-label="Change profile picture"
          >
            {avatarBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div>
          <p className="font-semibold text-ink-900 dark:text-white">{user.full_name}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
            {!showEmailForm && (
              <button
                type="button"
                onClick={() => {
                  setShowEmailForm(true);
                  setEmailForm({ email: user.email, current_password: '' });
                  setEmailError('');
                }}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Change
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">{t('settings_avatar')} — JPEG, PNG, or WebP, up to 2MB.</p>
        </div>
      </div>

      {showEmailForm && (
        <form
          onSubmit={handleEmailSubmit}
          className="mt-6 space-y-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800"
        >
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Change Email</h2>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">New Email</label>
            <input
              type="email"
              required
              value={emailForm.email}
              onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Current Password</label>
            <input
              type="password"
              required
              value={emailForm.current_password}
              onChange={(e) => setEmailForm((f) => ({ ...f, current_password: e.target.value }))}
              placeholder="Confirm it's you"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          {emailError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{emailError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={emailSaving}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {emailSaving && <Loader2 size={14} className="animate-spin" />}
              Save Email
            </button>
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{t('settings_username')}</label>
          <input
            value={form.username}
            onChange={update('username')}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{t('settings_full_name')}</label>
          <input
            value={form.full_name}
            onChange={update('full_name')}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{t('settings_phone')}</label>
          <input
            value={form.phone_number}
            onChange={update('phone_number')}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{t('settings_zone')}</label>
          <select
            value={form.location_zone}
            onChange={update('location_zone')}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Date of Birth</label>
          <input
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.date_of_birth}
            onChange={update('date_of_birth')}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <p className="mt-1 text-xs text-slate-400">Get an automatic 5% discount on any order dropped off on your birthday 🎂</p>
        </div>
        <motion.button
          type="submit"
          disabled={saving}
          whileHover={{ scale: saving ? 1 : 1.02 }}
          whileTap={{ scale: saving ? 1 : 0.98 }}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />} {t('settings_save')}
        </motion.button>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{t('settings_language')}</label>
          <select
            value={lang}
            onChange={(e) => handlePreferenceChange('preferred_language', e.target.value, setLang)}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-400">Translations currently cover navigation and this page only.</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{t('settings_theme')}</label>
          <div className="mt-2 flex gap-2">
            {['light', 'dark'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handlePreferenceChange('theme_preference', option, setTheme)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  theme === option
                    ? 'border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-900/30'
                    : 'border-slate-200 text-slate-500 hover:border-brand-300 dark:border-slate-600 dark:text-slate-300'
                }`}
              >
                {t(option === 'light' ? 'theme_light' : 'theme_dark')}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{t('settings_currency')}</label>
          <select
            value={currencyCode}
            onChange={(e) => handlePreferenceChange('preferred_currency', e.target.value, setCurrencyCode)}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-400">Display only — orders are always charged in GHS.</p>
        </div>
      </div>

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          saving={avatarBusy}
          onCancel={() => setCropFile(null)}
          onSave={handleCropSave}
        />
      )}
    </div>
  );
}
