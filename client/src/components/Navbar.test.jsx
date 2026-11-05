import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Navbar from './Navbar.jsx';

const auth = vi.hoisted(() => ({ user: null, logout: vi.fn(), updateProfile: vi.fn() }));
const theme = vi.hoisted(() => ({ resolvedTheme: 'light', toggleTheme: vi.fn(() => 'dark') }));

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));
vi.mock('../context/ThemeContext.jsx', () => ({ useTheme: () => theme }));
vi.mock('../context/LanguageContext.jsx', () => ({ useLanguage: () => ({ t: (key) => key }) }));
vi.mock('./NotificationBell.jsx', () => ({ default: () => <span data-testid="bell" /> }));

function renderNavbar() {
  return render(
    <MemoryRouter initialEntries={['/somewhere']}>
      <Navbar />
      <Routes>
        <Route path="/" element={<p>home page</p>} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  auth.updateProfile.mockResolvedValue({});
  theme.resolvedTheme = 'light';
});

describe('Navbar', () => {
  it('shows the public pages and the log in / sign up links to a visitor', () => {
    renderNavbar();
    for (const key of ['nav_home', 'nav_about', 'nav_services', 'nav_pricing', 'nav_contact']) {
      expect(screen.getAllByText(key).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole('link', { name: 'nav_login' })[0]).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link', { name: 'nav_signup' })[0]).toHaveAttribute('href', '/register');
    expect(screen.queryByTestId('bell')).not.toBeInTheDocument();
  });

  it('greets a customer by first name and links to their dashboard', () => {
    auth.user = { role: 'customer', full_name: 'Ama Serwaa', avatar_url: null };
    renderNavbar();
    expect(screen.getByText(/Hi, Ama/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'nav_dashboard' })[0]).toHaveAttribute('href', '/dashboard');
    expect(screen.getAllByTestId('bell').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'nav_login' })).not.toBeInTheDocument();
  });

  it('hides the marketing pages from staff and points them at their workspace', () => {
    auth.user = { role: 'laundry_staff', full_name: 'Kofi Mensah' };
    renderNavbar();
    expect(screen.queryByText('nav_about')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'nav_dashboard' })[0]).toHaveAttribute('href', '/staff');
  });

  it('sends administrators to the admin workspace', () => {
    auth.user = { role: 'administrator', full_name: 'Abena Admin' };
    renderNavbar();
    expect(screen.getAllByRole('link', { name: 'nav_dashboard' })[0]).toHaveAttribute('href', '/admin');
  });

  it('switches theme and saves the choice for a signed-in person', () => {
    auth.user = { role: 'customer', full_name: 'Ama Serwaa' };
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(theme.toggleTheme).toHaveBeenCalledOnce();
    expect(auth.updateProfile).toHaveBeenCalledWith({ theme_preference: 'dark' });
  });

  it('switches theme for a visitor without trying to save it', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(theme.toggleTheme).toHaveBeenCalledOnce();
    expect(auth.updateProfile).not.toHaveBeenCalled();
  });

  it('offers the way back to light from any dark theme', () => {
    theme.resolvedTheme = 'midnight';
    renderNavbar();
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('logs out from the profile menu and returns to the home page', () => {
    auth.user = { role: 'customer', full_name: 'Ama Serwaa' };
    renderNavbar();
    fireEvent.click(screen.getByText(/Hi, Ama/));
    fireEvent.click(screen.getByRole('button', { name: /nav_logout/ }));
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(screen.getByText('home page')).toBeInTheDocument();
  });
});
