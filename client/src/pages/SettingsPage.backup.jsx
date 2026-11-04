import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Box,
  Camera,
  ChevronRight,
  Clock3,
  Mail,
  Loader2,
  MessageCircle,
  Settings2,
  ShieldAlert,
  Trash2,
  User,
  UserRound,
  WalletCards,
  Building2,
  CircleDollarSign,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { SUPPORTED_LANGUAGES } from '../lib/i18n';
import AvatarCropModal from '../components/AvatarCropModal.jsx';

const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function avatarSrc(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return 'AA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function splitName(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' '),
  };
}

const notificationSettings = [
  {
    field: 'sms_order_updates',
    title: 'SMS order updates',
    description: 'Get a text when an order status changes.',
    icon: MessageCircle,
  },
  {
    field: 'email_order_updates',
    title: 'Email order updates',
    description: 'Receive order activity and status updates by email.',
    icon: Mail,
  },
  {
    field: 'pickup_reminders',
    title: 'Pickup reminders',
    description: 'Get reminded when a customer pickup is approaching.',
    icon: Clock3,
  },
  {
    field: 'low_stock_alerts',
    title: 'Low-stock alerts',
    description: 'Be notified when laundry supplies need attention.',
    icon: ShieldAlert,
    adminOnly: true,
  },
  {
    field: 'invoice_notifications',
    title: 'Invoice notifications',
    description: 'Receive messages about invoices and billing activity.',
    icon: Box,
  },
];

const preferenceSettings = [
  {
    field: 'birthday_discount_enabled',
    title: 'Birthday discount',
    description: 'Automatically apply the 5% birthday discount when eligible.',
  },
  {
    field: 'auto_generate_invoice',
    title: 'Auto-generate invoice',
    description: 'Automatically create an invoice when an eligible order is created.',
  },
];

export default function SettingsPage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    currencies,
    code: currencyCode,
    setCode: setCurrencyCode,
  } = useCurrency();
  const { lang, setLang, t } = useLanguage();
  const toast = useToast();

  const [zones, setZones] = useState([]);
  const [activeSection, setActiveSection] = useState('account');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [username, setUsername] = useState('');
  const [locationZone, setLocationZone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const fileInputRef = useRef(null);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailForm, setEmailForm] = useState({
    email: '',
    current_password: '',
  });
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [settingsBusy, setSettingsBusy] = useState({});

  useEffect(() => {
    api
      .get('/zones')
      .then(({ data }) => setZones(data.zones || []))
      .catch(() => setZones([]));
  }, []);

  useEffect(() => {
    const names = splitName(user?.full_name || '');

    setFirstName(names.first_name);
    setLastName(names.last_name);
    setPhoneNumber(user?.phone_number || '');
    setUsername(user?.username || '');
    setLocationZone(user?.location_zone || '');
    setDateOfBirth(
      user?.date_of_birth ? user.date_of_birth.slice(0, 10) : ''
    );
  }, [
    user?.full_name,
    user?.phone_number,
    user?.username,
    user?.location_zone,
    user?.date_of_birth,
  ]);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const fullName = [firstName.trim(), lastName.trim()]
        .filter(Boolean)
        .join(' ');

      await updateProfile({
        username: username.trim(),
        full_name: fullName,
        phone_number: phoneNumber.trim(),
        location_zone: locationZone,
        date_of_birth: dateOfBirth || null,
      });

      toast.success(t('settings_saved'));
    } catch (err) {
      toast.error(
        err.response?.data?.error || 'Unable to save your changes.'
      );
    } finally {
      setSavingProfile(false);
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
      toast.error(
        err.response?.data?.error || 'Unable to upload that image.'
      );
    } finally {
      setAvatarBusy(false);
    }
  }

async function handleToggle(field, value, label) {
  if (settingsBusy[field]) return;

  setSettingsBusy((current) => ({
    ...current,
    [field]: true,
  }));

  try {
    await updateProfile({
      [field]: value,
    });

    toast.success(`${label} turned ${value ? 'on' : 'off'}`);
  } catch (err) {
    toast.error(
      err.response?.data?.error || `Unable to update ${label.toLowerCase()}.`
    );
  } finally {
    setSettingsBusy((current) => ({
      ...current,
      [field]: false,
    }));
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
      setEmailForm({
        email: '',
        current_password: '',
      });
    } catch (err) {
      setEmailError(
        err.response?.data?.error || 'Unable to update your email.'
      );
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleGeneralPreference(field, value, applyLocal) {
    try {
      await updateProfile({
        [field]: value,
      });

      applyLocal(value);
    } catch (err) {
      toast.error(
        err.response?.data?.error || 'Unable to save that preference.'
      );
    }
  }

  const accountSections = [
    {
      id: 'account',
      label: 'Account',
      icon: UserRound,
    },
    {
      id: 'branches',
      label: 'Branches',
      icon: Building2,
    },
    {
      id: 'pricing',
      label: 'Pricing',
      icon: CircleDollarSign,
    },
  ];

  const systemSections = [
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
    },
    {
      id: 'preferences',
      label: 'Preferences',
      icon: Settings2,
    },
  ];

  const showSection = (section) => {
    setActiveSection(section);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-[1180px] flex-col px-4 py-6 sm:px-6 lg:flex-row lg:px-8 lg:py-8">
        {/* Settings navigation */}
        <aside className="w-full shrink-0 border-b border-slate-200 pb-4 dark:border-slate-800 lg:w-[232px] lg:border-b-0 lg:border-r lg:pb-0 lg:pr-7">
          <div className="mb-3 px-2 text-sm font-semibold text-slate-900 dark:text-white">
            Settings
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-6 lg:overflow-visible">
            <div className="shrink-0">
              <p className="mb-2 hidden px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:block">
                General
              </p>

              <div className="flex gap-1 lg:block">
                {accountSections.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => showSection(item.id)}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:w-full ${
                        active
                          ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.8} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0">
              <p className="mb-2 hidden px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:block">
                System
              </p>

              <div className="flex gap-1 lg:block">
                {systemSections.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => showSection(item.id)}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:w-full ${
                        active
                          ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.8} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 lg:pl-14">
          {activeSection === 'account' && (
            <section className="mx-auto max-w-[640px]">
              <div>
                <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Account
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Your staff profile and how Mum&apos;s Love reaches you and
                  your customers.
                </p>
              </div>

              {/* Profile picture */}
              <div className="mt-9 flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative shrink-0">
                  {user?.avatar_url ? (
                    <img
                      src={avatarSrc(user.avatar_url)}
                      alt={user.full_name || 'Profile'}
                      className="h-20 w-20 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-lg font-semibold text-white">
                      {getInitials(user?.full_name)}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarBusy}
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-50 bg-red-600 text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60 dark:border-slate-950"
                    aria-label="Change profile picture"
                  >
                    {avatarBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Camera size={12} />
                    )}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Profile picture
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    PNG or JPEG under 15MB
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarBusy}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Upload new picture
                    </button>

                    <button
                      type="button"
                      disabled={!user?.avatar_url || avatarBusy}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Trash2 size={13} />
                        Delete
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Profile fields */}
              <form onSubmit={handleProfileSubmit} className="mt-8">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400">
                      First name
                    </label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-red-500 dark:focus:ring-red-950"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400">
                      Last name
                    </label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-red-500 dark:focus:ring-red-950"
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Username
                  </label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-red-500 dark:focus:ring-red-950"
                  />
                </div>

                <div className="mt-5">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Phone number
                  </label>
                  <input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-red-500 dark:focus:ring-red-950"
                  />
                </div>

                <div className="mt-5">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Location zone
                  </label>
                  <select
                    value={locationZone}
                    onChange={(e) => setLocationZone(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-red-500 dark:focus:ring-red-950"
                  >
                    {zones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Date of birth
                  </label>
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-red-500 dark:focus:ring-red-950"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Used for birthday eligibility and your birthday discount.
                  </p>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {savingProfile && (
                      <Loader2 size={14} className="animate-spin" />
                    )}
                    Save changes
                  </button>
                </div>
              </form>

              {/* Email */}
              <div className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Email address
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {user?.email}
                    </p>
                  </div>

                  {!showEmailForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmailForm(true);
                        setEmailForm({
                          email: user?.email || '',
                          current_password: '',
                        });
                        setEmailError('');
                      }}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Change
                    </button>
                  )}
                </div>

                {showEmailForm && (
                  <form
                    onSubmit={handleEmailSubmit}
                    className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400">
                        New email
                      </label>
                      <input
                        type="email"
                        required
                        value={emailForm.email}
                        onChange={(e) =>
                          setEmailForm((current) => ({
                            ...current,
                            email: e.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400">
                        Current password
                      </label>
                      <input
                        type="password"
                        required
                        value={emailForm.current_password}
                        onChange={(e) =>
                          setEmailForm((current) => ({
                            ...current,
                            current_password: e.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </div>

                    {emailError && (
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
                        {emailError}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={emailSaving}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {emailSaving && (
                          <Loader2 size={13} className="animate-spin" />
                        )}
                        Save email
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowEmailForm(false)}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                             </div>

                {/* Display preferences */}
                <div className="mt-8 border-t border-slate-200 pt-8 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Display preferences
                  </h2>

                  <div className="mt-4 grid min-w-0 grid-cols-3 gap-3">
                    {/* Language */}
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <label className="text-[11px] font-medium text-slate-400">
                        Language
                      </label>

                      <select
                        value={lang}
                        onChange={(e) =>
                          handleGeneralPreference(
                            'preferred_language',
                            e.target.value,
                            setLang
                          )
                        }
                        className="mt-2 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      >
                        {SUPPORTED_LANGUAGES.map((language) => (
                          <option key={language.code} value={language.code}>
                            {language.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Theme */}
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <label className="text-[11px] font-medium text-slate-400">
                        Theme
                      </label>

                      <div className="mt-2 grid grid-cols-3 gap-1">
                        {['light', 'dark', 'system'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              handleGeneralPreference(
                                'theme_preference',
                                option,
                                setTheme
                              )
                            }
                            className={`min-w-0 rounded-lg border px-1 py-2 text-[11px] font-semibold transition ${
                              theme === option
                                ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                          >
                            {option === 'light'
                              ? 'Light'
                              : option === 'dark'
                                ? 'Dark'
                                : 'System'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Currency */}
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <label className="text-[11px] font-medium text-slate-400">
                        Currency
                      </label>

                      <select
                        value={currencyCode}
                        onChange={(e) =>
                          handleGeneralPreference(
                            'preferred_currency',
                            e.target.value,
                            setCurrencyCode
                          )
                        }
                        className="mt-2 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      >
                        {currencies.map((currency) => (
                          <option key={currency.code} value={currency.code}>
                            {currency.code} — {currency.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'branches' && (
            <section className="mx-auto max-w-[640px]">
              <div>
                <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Notifications
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Choose which messages get sent and when.
                </p>
              </div>

              <div className="mt-8 space-y-2">
                {notificationSettings.map((setting) => {
                  const Icon = setting.icon;
                  const enabled = Boolean(user?.[setting.field]);
                  const busy = Boolean(settingsBusy[setting.field]);

                  return (
                    <div
                      key={setting.field}
                      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <Icon size={18} strokeWidth={1.8} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {setting.title}
                          </p>

                          {setting.adminOnly && (
                            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-600 dark:bg-red-950/40 dark:text-red-400">
                              Admin
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {setting.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={`Toggle ${setting.title}`}
                        disabled={busy}
                        onClick={() =>
                          handleToggle(
                            setting.field,
                            !enabled,
                            setting.title
                          )
                        }
                        className={`relative h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${
                          enabled
                            ? 'bg-red-600'
                            : 'bg-slate-200 dark:bg-slate-700'
                        } ${busy ? 'cursor-wait opacity-60' : ''}`}
                      >
                        <span
                          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                            enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeSection === 'preferences' && (
            <section className="mx-auto max-w-[640px]">
              <div>
                <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Preferences
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Control defaults that affect how Mum&apos;s Love handles
                  orders and invoices.
                </p>
              </div>

              <div className="mt-8 space-y-2">
                {preferenceSettings.map((setting) => {
                  const enabled = Boolean(user?.[setting.field]);
                  const busy = Boolean(settingsBusy[setting.field]);

                  return (
                    <div
                      key={setting.field}
                      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <Settings2 size={18} strokeWidth={1.8} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {setting.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {setting.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={`Toggle ${setting.title}`}
                        disabled={busy}
                        onClick={() =>
                          handleToggle(
                            setting.field,
                            !enabled,
                            setting.title
                          )
                        }
                        className={`relative h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${
                          enabled
                            ? 'bg-red-600'
                            : 'bg-slate-200 dark:bg-slate-700'
                        } ${busy ? 'cursor-wait opacity-60' : ''}`}
                      >
                        <span
                          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                            enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeSection === 'branches' && (
            <section className="mx-auto max-w-[640px]">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Branches
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Branch management remains available through the existing
                administration workspace.
              </p>

              <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <Building2
                    size={18}
                    className="text-slate-400"
                    strokeWidth={1.8}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Branch management
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Use the administration tools to add, edit, or manage
                      laundry branches.
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="ml-auto text-slate-400"
                  />
                </div>
              </div>
            </section>
          )}

          {activeSection === 'pricing' && (
            <section className="mx-auto max-w-[640px]">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Pricing
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Pricing management remains available through the existing
                administration workspace.
              </p>

              <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <WalletCards
                    size={18}
                    className="text-slate-400"
                    strokeWidth={1.8}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Laundry pricing
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Manage item pricing from the existing pricing and
                      administration tools.
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="ml-auto text-slate-400"
                  />
                </div>
              </div>
            </section>
          )}
        </main>
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