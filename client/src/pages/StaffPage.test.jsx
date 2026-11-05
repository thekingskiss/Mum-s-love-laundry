import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import StaffPage from './StaffPage.jsx';
import AdminPage from './AdminPage.jsx';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
const session = vi.hoisted(() => ({ role: 'laundry_staff', currentBranchId: '' }));

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 1, role: session.role, full_name: 'Ama Staff', branch_id: session.role === 'super_admin' ? null : 1 } }),
}));
vi.mock('../context/BranchContext.jsx', () => ({
  useBranch: () => ({
    branches: [],
    currentBranchId: session.currentBranchId,
    setCurrentBranchId: vi.fn(),
    isSuperAdmin: session.role === 'super_admin',
  }),
}));
vi.mock('../context/CurrencyContext.jsx', () => ({
  useCurrency: () => ({ formatPrice: (value) => `GHS ${Number(value).toFixed(2)}` }),
}));
vi.mock('../context/ToastContext.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StaffPage />
    </MemoryRouter>
  );
}

function renderAdminAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminPage />
    </MemoryRouter>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <p>{location.pathname + location.search}</p>;
}

const OVERVIEW = {
  orders_today: 1,
  ready_for_pickup: 2,
  overdue_pickups: 3,
  late_fees_accruing: 1,
  revenue_this_week: 100,
  outstanding_balance: 50,
  low_stock_count: 4,
  unread_messages: 5,
  by_branch: [
    { id: 1, name: 'Main', orders_today: 1, ready_for_pickup: 2, overdue_pickups: 3, revenue_this_week: 100, outstanding_balance: 50 },
    { id: 2, name: 'Second', orders_today: 0, ready_for_pickup: 0, overdue_pickups: 0, revenue_this_week: 0, outstanding_balance: 0 },
  ],
};

describe('StaffPage navigation', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation((url) => {
      if (url === '/admin/overview') return Promise.resolve({ data: OVERVIEW });
      if (url === '/admin/audit-log') return Promise.resolve({ data: { entries: [] } });
      return Promise.resolve({ data: { orders: [] } });
    });
    session.role = 'laundry_staff';
    session.currentBranchId = '';
  });

  it('applies the selected branch to Scheduled Pickups', async () => {
    session.role = 'super_admin';
    session.currentBranchId = '2';
    renderAdminAt('/admin?tab=pickups');
    expect(await screen.findByRole('heading', { level: 2, name: /scheduled pickups/i })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/orders', { params: { branch_id: '2' } });
  });

  it.each([
    ['/admin', 'Dashboard'],
    ['/admin?tab=orders', 'Orders'],
    ['/admin?tab=pickups', 'Scheduled Pickups'],
  ])('titles %s after the page', async (path, title) => {
    session.role = 'super_admin';
    renderAdminAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('shows the business overview and role badge in the admin workspace', async () => {
    session.role = 'super_admin';
    renderAdminAt('/admin');
    expect(await screen.findByRole('heading', { name: 'Business overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByText('Super Admin').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Branch comparison' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Overview' })).not.toBeInTheDocument();
  });

  it('keeps an administrator out of branches and the audit log', async () => {
    session.role = 'administrator';
    for (const tab of ['audit', 'branches']) {
      const { unmount } = renderAdminAt(`/admin?tab=${tab}`);
      expect(await screen.findByRole('heading', { name: 'Business overview' })).toBeInTheDocument();
      unmount();
    }
    expect(api.get).not.toHaveBeenCalledWith('/admin/audit-log');
  });

  describe('Staff accounts', () => {
    const TEAM = [
      { id: 10, full_name: 'Kofi Mensah', email: 'kofi@example.com', role: 'laundry_staff', branch_id: 1, branch_name: 'Koforidua', is_active: true },
    ];

    beforeEach(() => {
      api.get.mockImplementation((url) => {
        if (url === '/admin/staff') return Promise.resolve({ data: { staff: TEAM } });
        return Promise.resolve({ data: { orders: [] } });
      });
    });

    it('lets an administrator see their team and manage it, but not add accounts', async () => {
      session.role = 'administrator';
      renderAdminAt('/admin?tab=staff');
      expect(await screen.findByText('Kofi Mensah')).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith('/admin/staff');
      expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
      // Creating accounts stays with the super admin (the server enforces it too).
      expect(screen.queryByRole('button', { name: 'Create Account' })).not.toBeInTheDocument();
    });

    it('gives a super admin the form to add accounts as well', async () => {
      session.role = 'super_admin';
      renderAdminAt('/admin?tab=staff');
      expect(await screen.findByText('Kofi Mensah')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    });
  });

  describe('Pricing', () => {
    const ITEMS = [
      { id: 1, category: 'Bedding', item_name: 'Duvet', unit_price: '40.00', price_min: null, price_max: null, is_active: true },
      { id: 2, category: 'Bedding', item_name: 'Bathroom Mat', unit_price: null, price_min: '10.00', price_max: '20.00', is_active: true },
      { id: 3, category: 'Formal', item_name: 'Old Gown', unit_price: '90.00', price_min: null, price_max: null, is_active: false },
    ];

    beforeEach(() => {
      session.role = 'administrator';
      api.patch.mockReset();
      api.post.mockReset();
      api.get.mockImplementation((url) => {
        if (url === '/admin/items') return Promise.resolve({ data: { items: ITEMS } });
        return Promise.resolve({ data: { orders: [] } });
      });
    });

    it('shows an administrator every item, including inactive ones and ranges', async () => {
      renderAdminAt('/admin?tab=pricing');
      expect(await screen.findByText('Duvet')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Pricing' })).toBeInTheDocument();
      expect(screen.getByText('GHS 40.00')).toBeInTheDocument();
      expect(screen.getByText('GHS 10.00–20.00')).toBeInTheDocument();
      expect(screen.getByText('Old Gown')).toBeInTheDocument();
      expect(within(screen.getByText('Old Gown').closest('tr')).getByText('Inactive')).toBeInTheDocument();
      expect(within(screen.getByText('Duvet').closest('tr')).queryByText('Inactive')).not.toBeInTheDocument();
      expect(screen.getByText(/3 items, 2 active/)).toBeInTheDocument();
    });

    it('lets an administrator edit an item and saves every field', async () => {
      api.patch.mockResolvedValue({ data: { item: { ...ITEMS[0], item_name: 'Large Duvet' } } });
      renderAdminAt('/admin?tab=pricing');
      fireEvent.click(await screen.findByRole('button', { name: 'Edit Duvet' }));
      fireEvent.change(screen.getByLabelText('Item name'), { target: { value: ' Large Duvet ' } });
      fireEvent.change(screen.getByLabelText('Price (GHS)'), { target: { value: '45.5' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith('/admin/items/1', { item_name: 'Large Duvet', category: 'Bedding', unit_price: 45.5 })
      );
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
    });

    it('can change a fixed price into a range', async () => {
      api.patch.mockResolvedValue({ data: { item: ITEMS[0] } });
      renderAdminAt('/admin?tab=pricing');
      fireEvent.click(await screen.findByRole('button', { name: 'Edit Duvet' }));
      fireEvent.change(screen.getByLabelText('Pricing'), { target: { value: 'range' } });
      fireEvent.change(screen.getByLabelText('Min (GHS)'), { target: { value: '30' } });
      fireEvent.change(screen.getByLabelText('Max (GHS)'), { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith('/admin/items/1', { item_name: 'Duvet', category: 'Bedding', price_min: 30, price_max: 50 })
      );
    });

    it('keeps the form open when the server refuses the change', async () => {
      api.patch.mockRejectedValue({ response: { data: { error: 'An item with that name already exists.' } } });
      renderAdminAt('/admin?tab=pricing');
      fireEvent.click(await screen.findByRole('button', { name: 'Edit Duvet' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(api.patch).toHaveBeenCalled());
      expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('deactivates and reactivates items', async () => {
      api.patch.mockResolvedValue({ data: {} });
      renderAdminAt('/admin?tab=pricing');
      fireEvent.click(await screen.findByRole('button', { name: 'Deactivate Duvet' }));
      await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/items/1', { is_active: false }));
      fireEvent.click(screen.getByRole('button', { name: 'Activate Old Gown' }));
      await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/items/3', { is_active: true }));
    });

    it('adds a new item', async () => {
      api.post.mockResolvedValue({ data: { item: { ...ITEMS[0], item_name: 'Blanket' } } });
      renderAdminAt('/admin?tab=pricing');
      await screen.findByText('Duvet');
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
      fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Blanket' } });
      fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Bedding' } });
      fireEvent.change(screen.getByLabelText('Price (GHS)'), { target: { value: '25' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add to price list' }));
      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/admin/items', { item_name: 'Blanket', category: 'Bedding', unit_price: 25 })
      );
    });

    it('searches by item or category and filters by status', async () => {
      renderAdminAt('/admin?tab=pricing');
      await screen.findByText('Duvet');
      fireEvent.change(screen.getByLabelText('Search the price list'), { target: { value: 'formal' } });
      expect(screen.getByText('Old Gown')).toBeInTheDocument();
      expect(screen.queryByText('Duvet')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'active' } });
      expect(screen.getByText('No items match.')).toBeInTheDocument();
    });

    function expectNoEditControls() {
      for (const name of [/^edit /i, /^deactivate /i, /^activate /i, 'Add item', 'Save']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Item name')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Price (GHS)')).not.toBeInTheDocument();
    }

    it('shows laundry staff the full list, including inactive items and ranges', async () => {
      session.role = 'laundry_staff';
      renderAt('/staff?tab=pricing');
      expect(await screen.findByText('Duvet')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Pricing' })).toBeInTheDocument();
      expect(screen.getByText('GHS 40.00')).toBeInTheDocument();
      expect(screen.getByText('GHS 10.00–20.00')).toBeInTheDocument();
      expect(within(screen.getByText('Old Gown').closest('tr')).getByText('Inactive')).toBeInTheDocument();
      expect(screen.getByText(/3 items, 2 active/)).toBeInTheDocument();
    });

    it('gives laundry staff no way to change a price', async () => {
      session.role = 'laundry_staff';
      renderAt('/staff?tab=pricing');
      await screen.findByText('Duvet');
      expect(screen.getByText(/view only/i)).toBeInTheDocument();
      expectNoEditControls();
    });

    it('still lets laundry staff search and filter', async () => {
      session.role = 'laundry_staff';
      renderAt('/staff?tab=pricing');
      await screen.findByText('Duvet');
      fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'inactive' } });
      expect(screen.getByText('Old Gown')).toBeInTheDocument();
      expect(screen.queryByText('Duvet')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'all' } });
      fireEvent.change(screen.getByLabelText('Search the price list'), { target: { value: 'mat' } });
      expect(screen.getByText('Bathroom Mat')).toBeInTheDocument();
      expect(screen.queryByText('Duvet')).not.toBeInTheDocument();
    });

    it('is view only when an admin previews the staff view', async () => {
      renderAt('/staff?tab=pricing');
      await screen.findByText('Duvet');
      expectNoEditControls();
    });

    it('does not tell administrators the list is view only', async () => {
      renderAdminAt('/admin?tab=pricing');
      await screen.findByRole('button', { name: 'Edit Duvet' });
      expect(screen.queryByText(/view only/i)).not.toBeInTheDocument();
    });
  });

  it('lets a super admin open the audit log', async () => {
    session.role = 'super_admin';
    renderAdminAt('/admin?tab=audit');
    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/audit-log');
  });

  it('shows a clearly marked staff preview when an admin opens /staff', async () => {
    session.role = 'super_admin';
    renderAt('/staff');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText(/previewing the staff view/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to admin/i })).toHaveAttribute('href', '/admin');
  });

  it('sends an admin following an old /staff link to the same tab in /admin', async () => {
    session.role = 'super_admin';
    render(
      <MemoryRouter initialEntries={['/staff?tab=analytics']}>
        <Routes>
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/admin" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('/admin?tab=analytics')).toBeInTheDocument();
  });

  it('does not show laundry staff the preview notice', async () => {
    renderAt('/staff');
    await screen.findByRole('heading', { name: 'Overview' });
    expect(screen.queryByText(/previewing the staff view/i)).not.toBeInTheDocument();
  });

  it('shows the overview, not the order queue, when no tab is selected', async () => {
    renderAt('/staff');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new drop-off/i })).not.toBeInTheDocument();
  });

  it('shows the order queue, not the overview, on the orders tab', async () => {
    renderAt('/staff?tab=orders');
    expect(await screen.findByRole('button', { name: /new drop-off/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Overview' })).not.toBeInTheDocument();
  });

  it('falls back to the overview for a tab this role cannot open', async () => {
    renderAt('/staff?tab=analytics');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });
});
