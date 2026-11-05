import { describe, it, expect } from 'vitest';
import { checkStaffChange } from '../utils/staffRules';

const superAdmin = { id: 1, role: 'super_admin', branch_id: null };
const admin = { id: 2, role: 'administrator', branch_id: 5 };
const staffAt5 = { id: 10, role: 'laundry_staff', branch_id: 5, email: 's@x.com' };
const staffAt6 = { id: 11, role: 'laundry_staff', branch_id: 6, email: 't@x.com' };
const otherAdmin = { id: 12, role: 'administrator', branch_id: 5, email: 'a@x.com' };
const boss = { id: 13, role: 'super_admin', branch_id: null, email: 'b@x.com' };
const customer = { id: 14, role: 'customer', branch_id: null, email: 'c@x.com' };

const check = (actor, target, change) => checkStaffChange({ actor, target, change });

describe('checkStaffChange', () => {
  it('treats a missing account or a customer as not a staff account', () => {
    expect(check(superAdmin, null, { type: 'active' })).toMatchObject({ status: 404 });
    expect(check(superAdmin, customer, { type: 'active' })).toMatchObject({ status: 404 });
  });

  it('never lets anyone change their own account', () => {
    for (const type of ['active', 'role', 'branch', 'password']) {
      expect(check(superAdmin, { ...superAdmin, email: 'me@x.com' }, { type, role: 'laundry_staff', branchId: 1 }))
        .toMatchObject({ status: 400 });
    }
  });

  it('never changes a super admin account, so the shop cannot lock itself out', () => {
    expect(check(superAdmin, boss, { type: 'active' })).toMatchObject({ status: 403 });
    expect(check(superAdmin, boss, { type: 'role', role: 'laundry_staff' })).toMatchObject({ status: 403 });
    expect(check(admin, boss, { type: 'active' })).toMatchObject({ status: 403 });
  });

  describe('as a super admin', () => {
    it('can switch staff on and off, reset passwords, change roles and branches', () => {
      expect(check(superAdmin, staffAt5, { type: 'active' })).toBeNull();
      expect(check(superAdmin, staffAt5, { type: 'password' })).toBeNull();
      expect(check(superAdmin, staffAt5, { type: 'role', role: 'administrator' })).toBeNull();
      expect(check(superAdmin, otherAdmin, { type: 'role', role: 'laundry_staff' })).toBeNull();
      expect(check(superAdmin, staffAt5, { type: 'branch', branchId: 6 })).toBeNull();
    });

    it('cannot make anyone a super admin or an unknown role', () => {
      expect(check(superAdmin, staffAt5, { type: 'role', role: 'super_admin' })).toMatchObject({ status: 400 });
      expect(check(superAdmin, staffAt5, { type: 'role', role: 'customer' })).toMatchObject({ status: 400 });
      expect(check(superAdmin, staffAt5, { type: 'role', role: 'janitor' })).toMatchObject({ status: 400 });
    });

    it('needs a real branch id', () => {
      expect(check(superAdmin, staffAt5, { type: 'branch', branchId: NaN })).toMatchObject({ status: 400 });
    });
  });

  describe('as an administrator', () => {
    it('can switch laundry staff in their own branch on and off and reset their passwords', () => {
      expect(check(admin, staffAt5, { type: 'active' })).toBeNull();
      expect(check(admin, staffAt5, { type: 'password' })).toBeNull();
    });

    it('cannot touch staff in another branch', () => {
      expect(check(admin, staffAt6, { type: 'active' })).toMatchObject({ status: 403 });
    });

    it('cannot touch other administrators', () => {
      expect(check(admin, otherAdmin, { type: 'active' })).toMatchObject({ status: 403 });
      expect(check(admin, otherAdmin, { type: 'password' })).toMatchObject({ status: 403 });
    });

    it('cannot change roles or branches', () => {
      expect(check(admin, staffAt5, { type: 'role', role: 'administrator' })).toMatchObject({ status: 403 });
      expect(check(admin, staffAt5, { type: 'branch', branchId: 6 })).toMatchObject({ status: 403 });
    });

    it('cannot act when they have no branch of their own', () => {
      expect(check({ ...admin, branch_id: null }, staffAt5, { type: 'active' })).toMatchObject({ status: 403 });
    });
  });

  it('refuses anyone who is not an administrator or super admin', () => {
    expect(check({ id: 20, role: 'laundry_staff', branch_id: 5 }, staffAt5, { type: 'active' })).toMatchObject({ status: 403 });
  });
});
