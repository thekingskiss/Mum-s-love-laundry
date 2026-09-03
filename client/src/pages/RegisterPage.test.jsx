import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.jsx';
import RegisterPage from './RegisterPage.jsx';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { zones: ['Koforidua'] } }),
    post: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the registration form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('shows a validation error for an invalid phone number', async () => {
    const { container } = renderPage();

    fireEvent.change(screen.getByPlaceholderText('Ama Serwaa'), { target: { value: 'Ama Serwaa' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ama@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/\+233 20 000 0000/), { target: { value: 'not-a-phone' } });
    fireEvent.change(screen.getByDisplayValue('Select your zone'), { target: { value: 'Koforidua' } });
    fireEvent.change(screen.getByPlaceholderText(/at least 8 characters/i), { target: { value: 'password1' } });

    // fireEvent.submit bypasses native HTML5 constraint validation (required/
    // minLength/etc.) so this exercises the component's own JS validation.
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(screen.getByText(/valid phone number/i)).toBeInTheDocument();
    });
  });

  it('shows a validation error for a short password', async () => {
    const { container } = renderPage();

    fireEvent.change(screen.getByPlaceholderText('Ama Serwaa'), { target: { value: 'Ama Serwaa' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ama@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/\+233 20 000 0000/), { target: { value: '+233200000000' } });
    fireEvent.change(screen.getByDisplayValue('Select your zone'), { target: { value: 'Koforidua' } });
    fireEvent.change(screen.getByPlaceholderText(/at least 8 characters/i), { target: { value: 'short' } });

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument();
    });
  });
});
