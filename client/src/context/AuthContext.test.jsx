import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { SESSION_ENDED_EVENT } from '../lib/sessionEvents.js';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

let auth;
function Probe() {
  auth = useAuth();
  return <p data-testid="who">{auth.loading ? 'loading' : auth.user ? auth.user.email : 'signed out'}</p>;
}

const renderProvider = () => render(<AuthProvider><Probe /></AuthProvider>);
const ama = { id: 1, email: 'ama@example.com', role: 'customer' };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('AuthProvider', () => {
  it('starts signed out when there is no saved token, without calling the server', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('signed out'));
    expect(api.get).not.toHaveBeenCalled();
  });

  it('restores the person from a saved token', async () => {
    localStorage.setItem('mll_token', 'saved');
    api.get.mockResolvedValue({ data: { user: ama } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('ama@example.com'));
    expect(api.get).toHaveBeenCalledWith('/auth/me');
  });

  it('drops a saved token the server no longer accepts', async () => {
    localStorage.setItem('mll_token', 'revoked');
    api.get.mockRejectedValue({ response: { status: 401 } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('signed out'));
    expect(localStorage.getItem('mll_token')).toBeNull();
  });

  it('logs in: saves the token and the person', async () => {
    api.post.mockResolvedValue({ data: { token: 'new-token', user: ama } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('signed out'));

    await act(async () => {
      await auth.login('ama@example.com', 'secret-password');
    });

    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'ama@example.com', password: 'secret-password' });
    expect(localStorage.getItem('mll_token')).toBe('new-token');
    expect(screen.getByTestId('who')).toHaveTextContent('ama@example.com');
  });

  it('lets a failed login reach the caller and saves nothing', async () => {
    api.post.mockRejectedValue(new Error('Invalid email or password.'));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('signed out'));

    await expect(act(async () => { await auth.login('a@b.com', 'wrong'); })).rejects.toThrow('Invalid email or password.');
    expect(localStorage.getItem('mll_token')).toBeNull();
  });

  it('logs out: clears the token and the person', async () => {
    localStorage.setItem('mll_token', 'saved');
    api.get.mockResolvedValue({ data: { user: ama } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('ama@example.com'));

    act(() => auth.logout());

    expect(screen.getByTestId('who')).toHaveTextContent('signed out');
    expect(localStorage.getItem('mll_token')).toBeNull();
  });

  it('signs the person out when the server ends their session', async () => {
    localStorage.setItem('mll_token', 'saved');
    api.get.mockResolvedValue({ data: { user: ama } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('ama@example.com'));

    act(() => {
      window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: 'This account is no longer active.' }));
    });

    expect(screen.getByTestId('who')).toHaveTextContent('signed out');
  });
});
