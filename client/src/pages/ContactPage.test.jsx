import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { ToastProvider } from '../context/ToastContext.jsx';
import ToastContainer from '../components/ToastContainer.jsx';
import ContactPage from './ContactPage.jsx';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <ToastProvider>
        <ToastContainer />
        <ContactPage />
      </ToastProvider>
    </HelmetProvider>
  );
}

describe('ContactPage', () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  it('renders the contact form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /send us a message/i })).toBeInTheDocument();
  });

  it('shows a validation error when the message is missing', async () => {
    const { container } = renderPage();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ama' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ama@example.com' } });

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(screen.getByText(/please enter a message/i)).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits the message and shows a confirmation', async () => {
    api.post.mockResolvedValue({ data: { message: { id: 1 } } });
    const { container } = renderPage();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ama' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ama@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/how can we help/i), { target: { value: 'Where is my order?' } });

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/contact', {
        name: 'Ama',
        email: 'ama@example.com',
        message: 'Where is my order?',
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/message has been sent/i)).toBeInTheDocument();
    });
  });

  it('shows a toast (not an inline banner) when the server rejects the submission', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Server unavailable' } } });
    const { container } = renderPage();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ama' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ama@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/how can we help/i), { target: { value: 'Where is my order?' } });

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(screen.getByText('Server unavailable')).toBeInTheDocument();
    });
    // The form itself should still be showing (no persistent inline error banner replacing it).
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
  });
});
