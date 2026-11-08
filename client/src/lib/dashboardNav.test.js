import { describe, expect, it } from 'vitest';
import { isNavItemActive, phoneNav } from './dashboardNav.js';

const labels = (items) => items.map((item) => item.label);
const allItems = (nav) => nav.groups.flatMap((group) => group.items);

describe('phoneNav', () => {
  it('gives customers a raised Book button in the middle of their tabs', () => {
    const nav = phoneNav({ role: 'customer', pathname: '/dashboard' });
    expect(nav.kind).toBe('customer');
    expect(labels(nav.tabs)).toEqual(['Home', 'Orders', 'Book', 'Payments']);
    expect(nav.tabs.find((tab) => tab.primary).to).toBe('/book');
    expect(labels(allItems(nav))).toEqual(['Pricing', 'Notifications', 'Settings']);
    expect(nav.switchTo).toBeNull();
  });

  it('gives laundry staff the floor-work tabs and no admin pages', () => {
    const nav = phoneNav({ role: 'laundry_staff', pathname: '/staff' });
    expect(nav.kind).toBe('staff');
    expect(labels(nav.tabs)).toEqual(['Home', 'Orders', 'Customers', 'Messages']);
    expect(nav.tabs.every((tab) => tab.to.startsWith('/staff'))).toBe(true);
    expect(nav.switchTo).toBeNull();
    const more = labels(allItems(nav));
    expect(more).not.toContain('Analytics');
    expect(more).not.toContain('Staff accounts');
  });

  it('gives administrators the admin tabs, and every admin page in More', () => {
    const nav = phoneNav({ role: 'administrator', pathname: '/admin' });
    expect(nav.kind).toBe('admin');
    expect(labels(nav.tabs)).toEqual(['Overview', 'Orders', 'Messages', 'Payments']);
    expect(nav.switchTo).toEqual({ label: 'Open staff view', to: '/staff' });
    expect(labels(allItems(nav))).toEqual(
      expect.arrayContaining(['Analytics', 'Inventory', 'Staff accounts', 'Zones', 'Capacity', 'Settings'])
    );
  });

  it('shows the branches and audit log pages to super admins only', () => {
    const admin = labels(allItems(phoneNav({ role: 'administrator', pathname: '/admin' })));
    const superAdmin = labels(allItems(phoneNav({ role: 'super_admin', pathname: '/admin' })));
    expect(admin).not.toContain('Branches');
    expect(admin).not.toContain('Audit log');
    expect(superAdmin).toEqual(expect.arrayContaining(['Branches', 'Audit log']));
  });

  it('shows an administrator previewing /staff the staff navigation, with a way back', () => {
    const nav = phoneNav({ role: 'administrator', pathname: '/staff' });
    expect(nav.kind).toBe('staff');
    expect(nav.switchTo).toEqual({ label: 'Back to admin', to: '/admin' });
  });

  it('marks which admin pages carry attention badges', () => {
    const items = allItems(phoneNav({ role: 'super_admin', pathname: '/admin' }));
    expect(items.find((item) => item.label === 'Messages').badge).toBe('unread_messages');
    expect(items.find((item) => item.label === 'Inventory').badge).toBe('low_stock_count');
  });
});

describe('isNavItemActive', () => {
  const at = (pathname, search = '') => ({ pathname, search });

  it('matches a workspace home with no tab, or an explicit dashboard tab', () => {
    expect(isNavItemActive('/dashboard', at('/dashboard'))).toBe(true);
    expect(isNavItemActive('/admin', at('/admin', '?tab=dashboard'))).toBe(true);
    expect(isNavItemActive('/admin', at('/admin', '?tab=orders'))).toBe(false);
  });

  it('matches a tab only on its own path', () => {
    expect(isNavItemActive('/dashboard?tab=orders', at('/dashboard', '?tab=orders'))).toBe(true);
    expect(isNavItemActive('/dashboard?tab=orders', at('/dashboard'))).toBe(false);
    expect(isNavItemActive('/staff?tab=orders', at('/admin', '?tab=orders'))).toBe(false);
  });

  it('matches a page that has no tab, like settings', () => {
    expect(isNavItemActive('/settings', at('/settings'))).toBe(true);
    expect(isNavItemActive('/book', at('/dashboard'))).toBe(false);
  });
});
