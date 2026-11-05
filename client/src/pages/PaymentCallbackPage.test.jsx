import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import PaymentCallbackPage from './PaymentCallbackPage.jsx';
import api from '../api/axios';

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }));

function renderCallback(search = '?reference=mll_7_abc') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/payments/callback${search}`]}>
        <PaymentCallbackPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('PaymentCallbackPage', () => {
  it('asks the server to confirm the payment named in the address', async () => {
    api.get.mockResolvedValue({ data: { status: 'success' } });
    renderCallback('?reference=mll_7_abc');
    expect(screen.getByText('Confirming your payment...')).toBeInTheDocument();
    await screen.findByText('Payment successful');
    expect(api.get).toHaveBeenCalledWith('/paystack/verify/mll_7_abc');
  });

  it('also accepts the trxref name Paystack sometimes uses', async () => {
    api.get.mockResolvedValue({ data: { status: 'success' } });
    renderCallback('?trxref=mll_9_xyz');
    await screen.findByText('Payment successful');
    expect(api.get).toHaveBeenCalledWith('/paystack/verify/mll_9_xyz');
  });

  it.each(['abandoned', 'failed'])('reports a %s payment as not completed', async (status) => {
    api.get.mockResolvedValue({ data: { status } });
    renderCallback();
    await screen.findByText('Payment not completed');
    expect(screen.getByText(/No charge was made/i)).toBeInTheDocument();
  });

  it('tells the customer to wait when Paystack has not confirmed yet', async () => {
    api.get.mockResolvedValue({ data: { status: 'pending' } });
    renderCallback();
    await screen.findByText('Payment pending');
  });

  it('shows the server\'s reason when verification fails', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'You do not have permission to view this payment.' } } });
    renderCallback();
    await screen.findByText('Payment not completed');
    expect(screen.getByText('You do not have permission to view this payment.')).toBeInTheDocument();
  });

  it('does not call the server when there is no reference', async () => {
    renderCallback('');
    await screen.findByText('Payment not completed');
    expect(screen.getByText('No payment reference was found in the URL.')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('always offers a way back to the dashboard', async () => {
    api.get.mockResolvedValue({ data: { status: 'success' } });
    renderCallback();
    const link = await screen.findByRole('link', { name: 'Back to Dashboard' });
    expect(link).toHaveAttribute('href', '/dashboard');
  });
});
