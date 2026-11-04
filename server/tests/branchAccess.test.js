import { describe, it, expect } from 'vitest';
import { canAccessBranch, canViewOrder } from '../utils/branchAccess';

const superAdmin = { id: 1, role: 'super_admin', branch_id: null };
const staffA = { id: 2, role: 'laundry_staff', branch_id: 10 };
const adminB = { id: 3, role: 'administrator', branch_id: 20 };
const unassignedAdmin = { id: 4, role: 'administrator', branch_id: null };
const customer = { id: 5, role: 'customer', branch_id: null };

describe('canAccessBranch', () => {
  it('lets a super_admin reach any branch', () => {
    expect(canAccessBranch(superAdmin, 10)).toBe(true);
    expect(canAccessBranch(superAdmin, null)).toBe(true);
  });

  it('limits staff to their own branch', () => {
    expect(canAccessBranch(staffA, 10)).toBe(true);
    expect(canAccessBranch(staffA, 20)).toBe(false);
    expect(canAccessBranch(adminB, 10)).toBe(false);
  });

  it('denies staff with no branch, and records with no branch', () => {
    expect(canAccessBranch(unassignedAdmin, 10)).toBe(false);
    expect(canAccessBranch(staffA, null)).toBe(false);
  });
});

describe('canViewOrder', () => {
  const orderAtA = { user_id: customer.id, branch_id: 10 };

  it('lets the owning customer view it', () => {
    expect(canViewOrder(customer, orderAtA)).toBe(true);
  });

  it('blocks a different customer', () => {
    expect(canViewOrder({ id: 99, role: 'customer', branch_id: null }, orderAtA)).toBe(false);
  });

  it('allows staff at the order branch and blocks other branches', () => {
    expect(canViewOrder(staffA, orderAtA)).toBe(true);
    expect(canViewOrder(adminB, orderAtA)).toBe(false);
    expect(canViewOrder(superAdmin, orderAtA)).toBe(true);
  });

  it('lets staff view their own order placed at another branch', () => {
    expect(canViewOrder(adminB, { user_id: adminB.id, branch_id: 10 })).toBe(true);
  });
});
