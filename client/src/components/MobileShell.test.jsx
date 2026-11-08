import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileShell from './MobileShell.jsx';
import api from '../api/axios';

const session = vi.hoisted(() => ({
  user: null,
  logout: vi.fn(),
  updateProfile: vi.fn(() => Promise.resolve()),
}));

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => session }));
vi.mock('../context/BranchContext.jsx', () => ({ useBranch: () => ({ currentBranchId: '' }) }));
vi.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ resolvedTheme: 'light', toggleTheme: () => 'dark' }),
}));
vi.mock('./NotificationBell.jsx', () => ({ default: () => <button type="button" aria-label="Notifications" /> }));

const customer = { full_name: 'Ama Mensah', email: 'ama@example.com', role: 'customer' };
const admin = { full_name: 'Akosua Owusu', email: 'akosua@example.com', role: 'super_admin' };

function renderShell(path, user) {
  session.user = user;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MobileShell>
        <p>page content</p>
      </MobileShell>
    </MemoryRouter>
  );
}

const tabBar = () => screen.getByRole('navigation', { name: 'Main navigation' });

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: {} });
});

describe('MobileShell', () => {
  it('renders the page between the app bar and the tab bar', () => {
    renderShell('/dashboard', customer);
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent("Mum's Love");
  });

  it('shows a customer their tabs, with the current page marked', () => {
    renderShell('/dashboard?tab=orders', customer);
    const links = within(tabBar()).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Home', 'Orders', 'Book', 'Payments']);
    expect(links.filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.textContent)).toEqual(['Orders']);
    expect(within(tabBar()).getByRole('link', { name: 'Book' })).toHaveAttribute('href', '/book');
  });

  it('opens the More sheet from the tab bar and closes it with Escape', async () => {
    renderShell('/dashboard', customer);

    fireEvent.click(within(tabBar()).getByRole('button', { name: /More/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(sheet).getByText('Ama Mensah')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());
  });

  it('opens the same sheet from the avatar in the app bar', async () => {
    renderShell('/dashboard', customer);
    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  });

  it('logs out from the sheet', async () => {
    renderShell('/dashboard', customer);
    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(session.logout).toHaveBeenCalled();
  });

  it('shows an admin the attention counts on their tabs and More sheet', async () => {
    api.get.mockResolvedValue({ data: { unread_messages: 3, overdue_pickups: 2, low_stock_count: 0 } });
    renderShell('/admin', admin);

    // Messages is a tab; overdue pickups live in More, so the More tab gets a dot.
    expect(await within(tabBar()).findByLabelText('3 need attention')).toBeInTheDocument();
    expect(within(tabBar()).getByLabelText('2 need attention')).toBeInTheDocument();

    fireEvent.click(within(tabBar()).getByRole('button', { name: /More/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(sheet).getByRole('link', { name: /Scheduled Pickups/ })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Open staff view' })).toHaveAttribute('href', '/staff');
  });

  it("does not ask the admin API for figures on a customer's behalf", () => {
    renderShell('/dashboard', customer);
    expect(api.get).not.toHaveBeenCalled();
  });
});
