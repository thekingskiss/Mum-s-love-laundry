import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage.jsx';
import DashboardSidebar from '../components/DashboardSidebar.jsx';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
vi.mock('../context/AuthContext.jsx', () => {
  const user = { id: 1, role: 'customer', full_name: 'Ama Mensah', location_zone: 'Akropong' };
  return { useAuth: () => ({ user, logout: vi.fn() }) };
});
vi.mock('../context/BranchContext.jsx', () => ({
  useBranch: () => ({ currentBranchId: '' }),
}));
vi.mock('../context/CurrencyContext.jsx', () => ({
  useCurrency: () => ({ formatPrice: (value) => `GHS ${Number(value).toFixed(2)}` }),
}));
vi.mock('../context/ToastContext.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const ORDERS = [
  { id: 7, status: 'in_washing', items_summary: 'Shirt x2', drop_off_date: '2026-11-01', total_price: '40.00', balance_due: '40.00', amount_paid: '0', payment_status: 'unpaid' },
  { id: 6, status: 'completed', items_summary: 'Blanket x1', drop_off_date: '2026-10-01', total_price: '60.00', balance_due: '10.00', amount_paid: '50', payment_status: 'partial' },
  { id: 5, status: 'cancelled', items_summary: 'Towel x1', drop_off_date: '2026-09-01', total_price: '99.00', balance_due: '99.00', amount_paid: '0', payment_status: 'unpaid' },
];
const PAYMENTS = [
  { id: 1, order_id: 6, amount: '50.00', payment_method: 'cash', payment_type: 'partial', paid_at: '2026-10-02T10:00:00Z' },
];
const NOTIFICATIONS = [
  { id: 1, title: 'Order is washing', body: 'We started your order.', read_at: null, created_at: '2026-11-01T10:00:00Z' },
  { id: 2, title: 'Older update', body: 'Already seen.', read_at: '2026-10-01T10:00:00Z', created_at: '2026-10-01T10:00:00Z' },
];

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DashboardPage />
    </MemoryRouter>
  );
}

describe('customer dashboard pages', () => {
  beforeEach(() => {
    api.patch.mockReset();
    api.patch.mockResolvedValue({ data: {} });
    api.get.mockReset();
    api.get.mockImplementation((url) => {
      if (url === '/orders/user') return Promise.resolve({ data: { orders: ORDERS } });
      if (url === '/orders/user/payments') return Promise.resolve({ data: { payments: PAYMENTS } });
      if (url === '/notifications') return Promise.resolve({ data: { notifications: NOTIFICATIONS } });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  it('shows a summary on the dashboard, excluding cancelled orders from the balance', async () => {
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Current orders' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /welcome back, ama/i })).toBeInTheDocument();
    expect(screen.getByText('GHS 50.00')).toBeInTheDocument();
    expect(screen.getByText('Across 2 orders')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Order History' })).not.toBeInTheDocument();
  });

  it('shows active orders and history on My Orders', async () => {
    renderAt('/dashboard?tab=orders');
    expect(await screen.findByRole('heading', { name: 'Order History' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My Orders' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Current orders' })).not.toBeInTheDocument();
  });

  it('lists balances and all payments on Payments, with no Pay Now for cancelled orders', async () => {
    renderAt('/dashboard?tab=payments');
    expect(await screen.findByRole('heading', { name: 'Payment history' })).toBeInTheDocument();
    expect(await screen.findByText('+GHS 50.00')).toBeInTheDocument();
    expect(await screen.findAllByRole('button', { name: /pay now/i })).toHaveLength(2);
    expect(screen.queryByText('Order #5 · GHS 99.00 total')).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/orders/user/payments');
  });

  it('shows notifications and marks one as read when clicked', async () => {
    renderAt('/dashboard?tab=notifications');
    const unread = await screen.findByRole('button', { name: /order is washing/i });
    fireEvent.click(unread);
    expect(api.patch).toHaveBeenCalledWith('/notifications/1/read');
    expect(screen.queryByRole('button', { name: /mark all read/i })).not.toBeInTheDocument();
  });

  it('falls back to the summary for an unknown page', async () => {
    renderAt('/dashboard?tab=nonsense');
    expect(await screen.findByRole('heading', { name: 'Current orders' })).toBeInTheDocument();
  });
});

describe('customer sidebar', () => {
  function activeLinks(path) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <DashboardSidebar />
      </MemoryRouter>
    );
    const nav = screen.getByRole('navigation', { name: 'My account' });
    return within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent);
  }

  it.each([
    ['/dashboard', 'Dashboard'],
    ['/dashboard?tab=orders', 'My Orders'],
    ['/dashboard?tab=payments', 'Payments'],
    ['/dashboard?tab=notifications', 'Notifications'],
    ['/book', 'Book an Order'],
  ])('highlights only the matching item at %s', (path, label) => {
    expect(activeLinks(path)).toEqual([label]);
  });
});
