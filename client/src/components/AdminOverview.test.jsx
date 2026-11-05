import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../api/axios';
import AdminOverview from './AdminOverview.jsx';

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('../context/BranchContext.jsx', () => ({ useBranch: () => ({ currentBranchId: '' }) }));
vi.mock('../context/CurrencyContext.jsx', () => ({
  useCurrency: () => ({ formatPrice: (value) => `GHS ${Number(value).toFixed(2)}` }),
}));

const QUIET = {
  orders_today: 0,
  ready_for_pickup: 0,
  overdue_pickups: 0,
  late_fees_accruing: 0,
  revenue_this_week: 0,
  outstanding_balance: 0,
  low_stock_count: 0,
  unread_messages: 0,
  by_branch: [],
};

const BUSY = {
  ...QUIET,
  orders_today: 3,
  overdue_pickups: 2,
  late_fees_accruing: 1,
  revenue_this_week: 150,
  low_stock_count: 1,
  unread_messages: 4,
};

const trend = Array.from({ length: 14 }, (_, index) => ({
  date: `2026-11-${String(index + 1).padStart(2, '0')}`,
  revenue: index === 2 ? 100 : index === 8 ? 150 : 0,
  order_count: index === 2 || index === 8 ? 1 : 0,
}));

const ACTIVITY = {
  today: '2026-11-09',
  revenue_last_week_to_date: 100,
  orders_yesterday_to_date: 1,
  trend,
  pipeline: [{ status: 'in_washing', count: 2 }],
  recent_orders: [{ id: 7, status: 'in_washing', total_price: 150, customer_name: 'Ama Mensah' }],
  pickups: [{ id: 9, status: 'quality_check', customer_name: 'Kofi Boateng', days_late: 3 }],
};

function mockApi(overview, activity) {
  api.get.mockImplementation((url) => {
    if (url === '/admin/overview') return Promise.resolve({ data: overview });
    return activity ? Promise.resolve({ data: activity }) : Promise.reject(new Error('failed'));
  });
}

const renderOverview = () => render(<MemoryRouter><AdminOverview /></MemoryRouter>);

describe('AdminOverview', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('leads with what needs attention', async () => {
    mockApi(BUSY, ACTIVITY);
    renderOverview();
    expect(await screen.findByText('2 overdue pickups')).toBeInTheDocument();
    expect(screen.getByText('1 accruing storage fees')).toBeInTheDocument();
    expect(screen.getByText('1 item low on stock')).toBeInTheDocument();
    expect(screen.getByText('4 unread messages')).toBeInTheDocument();
  });

  it('says so when nothing needs attention', async () => {
    mockApi(QUIET, ACTIVITY);
    renderOverview();
    expect(await screen.findByText('Nothing needs attention right now')).toBeInTheDocument();
  });

  it('compares revenue and orders with the earlier period', async () => {
    mockApi(BUSY, ACTIVITY);
    renderOverview();
    expect(await screen.findByText('Up 50%')).toBeInTheDocument();
    expect(screen.getByText('vs this point last week')).toBeInTheDocument();
    expect(screen.getByText('Up 2')).toBeInTheDocument();
  });

  it('describes revenue instead of inventing a change from zero', async () => {
    mockApi(BUSY, { ...ACTIVITY, revenue_last_week_to_date: 0 });
    renderOverview();
    expect(await screen.findByText('Order value since Monday')).toBeInTheDocument();
  });

  it('names every chart column for screen readers and offers a table', async () => {
    mockApi(BUSY, ACTIVITY);
    renderOverview();
    expect(await screen.findByLabelText(/GHS 150\.00, 1 order$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View table' }));
    expect(screen.getByRole('columnheader', { name: 'Day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View chart' })).toBeInTheDocument();
  });

  it('shows the pipeline, recent orders and pickups', async () => {
    mockApi(BUSY, ACTIVITY);
    renderOverview();
    expect(await screen.findByText('2 active orders by stage')).toBeInTheDocument();
    expect(screen.getByText('Ama Mensah')).toBeInTheDocument();
    expect(screen.getByText('Kofi Boateng')).toBeInTheDocument();
    expect(screen.getByText('3 days late')).toBeInTheDocument();
  });

  it('shows empty states on a new shop', async () => {
    mockApi(QUIET, { ...ACTIVITY, trend: trend.map((day) => ({ ...day, revenue: 0 })), pipeline: [], recent_orders: [], pickups: [] });
    renderOverview();
    expect(await screen.findByText('No orders in the last two weeks yet.')).toBeInTheDocument();
    expect(screen.getByText('No orders in progress.')).toBeInTheDocument();
    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
    expect(screen.getByText('Nothing overdue or due today.')).toBeInTheDocument();
  });

  it('keeps the headline figures if the charts fail to load', async () => {
    mockApi(BUSY, null);
    renderOverview();
    expect(await screen.findByText('2 overdue pickups')).toBeInTheDocument();
    expect(await screen.findByText(/Unable to load the charts/)).toBeInTheDocument();
    expect(screen.getByText('GHS 150.00')).toBeInTheDocument();
  });
});
