import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import StaffAccountsPanel from './StaffAccountsPanel.jsx';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: { patch: vi.fn(), post: vi.fn() },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../context/ToastContext.jsx', () => ({ useToast: () => toast }));

const superAdmin = { id: 1, role: 'super_admin', branch_id: null, full_name: 'Boss' };
const admin = { id: 2, role: 'administrator', branch_id: 5, full_name: 'Abena' };

const kofi = { id: 10, full_name: 'Kofi Mensah', email: 'kofi@example.com', role: 'laundry_staff', branch_id: 5, branch_name: 'Koforidua', is_active: true };
const yaa = { id: 11, full_name: 'Yaa Asantewaa', email: 'yaa@example.com', role: 'laundry_staff', branch_id: 6, branch_name: 'Nkawkaw', is_active: true };
const former = { id: 12, full_name: 'Kwame Old', email: 'kwame@example.com', role: 'laundry_staff', branch_id: 5, branch_name: 'Koforidua', is_active: false };
const peerAdmin = { id: 13, full_name: 'Efua Admin', email: 'efua@example.com', role: 'administrator', branch_id: 5, branch_name: 'Koforidua', is_active: true };

const onChanged = vi.fn();
const rowFor = (name) => screen.getByText(name).closest('tr');

function renderPanel(currentUser, staff) {
  return render(<StaffAccountsPanel staff={staff} currentUser={currentUser} onChanged={onChanged} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.patch.mockResolvedValue({ data: {} });
  api.post.mockResolvedValue({ data: {} });
});

describe('StaffAccountsPanel', () => {
  it('shows each person with an Active or Deactivated status', () => {
    renderPanel(superAdmin, [kofi, former]);
    expect(within(rowFor('Kofi Mensah')).getByText('Active')).toBeInTheDocument();
    expect(within(rowFor('Kwame Old')).getByText('Deactivated')).toBeInTheDocument();
  });

  it('asks before deactivating, then deactivates and says so', async () => {
    renderPanel(superAdmin, [kofi]);

    fireEvent.click(within(rowFor('Kofi Mensah')).getByRole('button', { name: /deactivate/i }));
    // Nothing is sent until it is confirmed.
    expect(api.patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/staff/10/active', { active: false }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('deactivated'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('lets you back out of a deactivation', () => {
    renderPanel(superAdmin, [kofi]);
    fireEvent.click(within(rowFor('Kofi Mensah')).getByRole('button', { name: /deactivate/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(within(rowFor('Kofi Mensah')).getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
  });

  it('reactivates a deactivated account in one click', async () => {
    renderPanel(superAdmin, [former]);
    fireEvent.click(within(rowFor('Kwame Old')).getByRole('button', { name: /reactivate/i }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/staff/12/active', { active: true }));
  });

  it('shows the server\'s reason when a change is refused', async () => {
    api.patch.mockRejectedValue({ response: { data: { error: 'Only a super admin can manage administrator accounts.' } } });
    renderPanel(superAdmin, [kofi]);
    fireEvent.click(within(rowFor('Kofi Mensah')).getByRole('button', { name: /deactivate/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Only a super admin can manage administrator accounts.'));
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('changes a role from the dropdown (super admin only)', async () => {
    renderPanel(superAdmin, [kofi]);
    fireEvent.change(screen.getByLabelText('Role for Kofi Mensah'), { target: { value: 'administrator' } });
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/staff/10', { role: 'administrator' }));
  });

  it('resets a password with a minimum length and never shows it again', async () => {
    renderPanel(superAdmin, [kofi]);
    fireEvent.click(within(rowFor('Kofi Mensah')).getByRole('button', { name: /reset password/i }));

    const field = screen.getByLabelText('New password for Kofi Mensah');
    expect(field).toHaveAttribute('minlength', '8');
    expect(field).toHaveAttribute('type', 'password');
    fireEvent.change(field, { target: { value: 'a-new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/staff/10/password', { password: 'a-new-password' }));
    await waitFor(() => expect(screen.queryByLabelText('New password for Kofi Mensah')).not.toBeInTheDocument());
  });

  describe('as an administrator', () => {
    it('can act on laundry staff in their own branch but cannot change roles', () => {
      renderPanel(admin, [kofi]);
      const row = rowFor('Kofi Mensah');
      expect(within(row).getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: /reset password/i })).toBeInTheDocument();
      expect(screen.queryByLabelText('Role for Kofi Mensah')).not.toBeInTheDocument();
    });

    it('is offered nothing for another branch\'s staff or for other administrators', () => {
      renderPanel(admin, [yaa, peerAdmin]);
      expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reset password/i })).not.toBeInTheDocument();
    });
  });

  it('offers nothing on your own row', () => {
    renderPanel(superAdmin, [{ ...kofi, id: 1, full_name: 'Boss' }]);
    expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
  });

  it('says so when there are no accounts', () => {
    renderPanel(superAdmin, []);
    expect(screen.getByText('No staff accounts yet.')).toBeInTheDocument();
  });
});
