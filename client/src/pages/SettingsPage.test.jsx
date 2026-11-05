import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import SettingsPage from './SettingsPage.jsx';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { zones: [] } })) },
}));
const session = vi.hoisted(() => ({ role: 'administrator' }));

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 1, role: session.role, full_name: 'Ama Admin', email: 'ama@example.com' },
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
  }),
}));
vi.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));
vi.mock('../context/CurrencyContext.jsx', () => ({
  useCurrency: () => ({ currencies: [], code: 'GHS', setCode: vi.fn() }),
}));
vi.mock('../context/LanguageContext.jsx', () => ({
  useLanguage: () => ({ lang: 'en', setLang: vi.fn(), t: (key) => key }),
}));
vi.mock('../context/ToastContext.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsPage />
      <LocationProbe />
    </MemoryRouter>
  );
}

describe('SettingsPage admin sections', () => {
  beforeEach(() => {
    session.role = 'administrator';
  });

  it.each(['administrator', 'super_admin'])('takes %s to the price list from Manage pricing', (role) => {
    session.role = role;
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Pricing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage pricing' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin?tab=pricing');
  });

  it('takes a super admin to branches from Manage', () => {
    session.role = 'super_admin';
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Branches' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin?tab=branches');
  });

  it('keeps branches away from an administrator', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: 'Branches' })).not.toBeInTheDocument();
  });

  it.each(['laundry_staff', 'customer'])('hides pricing from %s', (role) => {
    session.role = role;
    renderSettings();
    expect(screen.queryByRole('button', { name: 'Pricing' })).not.toBeInTheDocument();
  });
});
