import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';
import { LanguageProvider } from '../context/LanguageContext.jsx';

const login = vi.hoisted(() => vi.fn());
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ login, user: null }),
}));

function renderLogin(entry = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LanguageProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<p>customer dashboard</p>} />
          <Route path="/staff" element={<p>staff workspace</p>} />
          <Route path="/admin" element={<p>admin workspace</p>} />
          <Route path="/book" element={<p>booking page</p>} />
        </Routes>
      </LanguageProvider>
    </MemoryRouter>
  );
}

function fillAndSubmit(email = 'ama@example.com', password = 'secret-password') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.submit(screen.getByRole('button', { name: /log in/i }).closest('form'));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.dir = 'ltr';
});

describe('LoginPage', () => {
  it('has fields a screen reader can name, linked to their labels', () => {
    renderLogin();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('logs a customer in and sends them to the dashboard', async () => {
    login.mockResolvedValue({ role: 'customer' });
    renderLogin();
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText('customer dashboard')).toBeInTheDocument());
    expect(login).toHaveBeenCalledWith('ama@example.com', 'secret-password');
  });

  it('sends staff to their own workspace, whatever page they came from', async () => {
    login.mockResolvedValue({ role: 'laundry_staff' });
    renderLogin();
    fillAndSubmit();
    await waitFor(() => expect(screen.getByText('staff workspace')).toBeInTheDocument());
  });

  it('sends administrators to the admin workspace', async () => {
    login.mockResolvedValue({ role: 'administrator' });
    renderLogin();
    fillAndSubmit();
    await waitFor(() => expect(screen.getByText('admin workspace')).toBeInTheDocument());
  });

  it('takes a customer back to the page that asked them to log in', async () => {
    login.mockResolvedValue({ role: 'customer' });
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/book' } }]}>
        <LanguageProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/book" element={<p>booking page</p>} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    );
    fillAndSubmit();
    await waitFor(() => expect(screen.getByText('booking page')).toBeInTheDocument());
  });

  it('shows the server\'s message when login fails, and stays on the page', async () => {
    login.mockRejectedValue({ response: { data: { error: 'This account has been deactivated. Please contact the shop.' } } });
    renderLogin();
    fillAndSubmit();
    expect(await screen.findByText('This account has been deactivated. Please contact the shop.')).toBeInTheDocument();
    expect(screen.queryByText('customer dashboard')).not.toBeInTheDocument();
  });

  it('shows a plain message when the server cannot be reached', async () => {
    login.mockRejectedValue(new Error('Network Error'));
    renderLogin();
    fillAndSubmit();
    expect(await screen.findByText('Unable to log in. Please try again.')).toBeInTheDocument();
  });

  it('disables the button while logging in', async () => {
    let finish;
    login.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderLogin();
    fillAndSubmit();
    expect(await screen.findByRole('button', { name: /logging in/i })).toBeDisabled();
    finish({ role: 'customer' });
  });

  it('links to sign-up and to password recovery', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/register');
  });

  it('speaks the chosen language', () => {
    localStorage.setItem('mll_language', 'fr');
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Bon retour' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
  });

  it('flips to right-to-left for Arabic', () => {
    localStorage.setItem('mll_language', 'ar');
    renderLogin();
    expect(screen.getByRole('heading', { name: 'مرحبًا بعودتك' })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });
});
