import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';

const session = vi.hoisted(() => ({ user: null, loading: false }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => session }));

function renderGuard(roles) {
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route path="/secret" element={<ProtectedRoute roles={roles}><p>secret page</p></ProtectedRoute>} />
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/dashboard" element={<p>customer dashboard</p>} />
        <Route path="/staff" element={<p>staff workspace</p>} />
        <Route path="/admin" element={<p>admin workspace</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('waits while the saved login is being checked, without flashing the login page', () => {
    session.user = null;
    session.loading = true;
    renderGuard();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
    expect(screen.queryByText('secret page')).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to the login page', () => {
    session.user = null;
    session.loading = false;
    renderGuard();
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('shows the page to anyone signed in when no roles are required', () => {
    session.user = { role: 'customer' };
    renderGuard();
    expect(screen.getByText('secret page')).toBeInTheDocument();
  });

  it('shows the page to a person with an allowed role', () => {
    session.user = { role: 'administrator' };
    renderGuard(['administrator', 'super_admin']);
    expect(screen.getByText('secret page')).toBeInTheDocument();
  });

  it.each([
    ['customer', 'customer dashboard'],
    ['laundry_staff', 'staff workspace'],
  ])('sends a %s who lacks the role to their own workspace', (role, landing) => {
    session.user = { role };
    renderGuard(['administrator', 'super_admin']);
    expect(screen.getByText(landing)).toBeInTheDocument();
    expect(screen.queryByText('secret page')).not.toBeInTheDocument();
  });
});
