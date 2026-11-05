import { describe, it, expect } from 'vitest';
import { staffActionsFor } from './staffAccounts';

const superAdmin = { id: 1, role: 'super_admin', branch_id: null };
const admin = { id: 2, role: 'administrator', branch_id: 5 };
const staffHere = { id: 10, role: 'laundry_staff', branch_id: 5 };
const staffElsewhere = { id: 11, role: 'laundry_staff', branch_id: 6 };
const otherAdmin = { id: 12, role: 'administrator', branch_id: 5 };

const ALL = { toggleActive: true, resetPassword: true, changeRole: true };
const NONE = { toggleActive: false, resetPassword: false, changeRole: false };

describe('staffActionsFor', () => {
  it('offers a super admin every action on staff and administrators', () => {
    expect(staffActionsFor(superAdmin, staffHere)).toEqual(ALL);
    expect(staffActionsFor(superAdmin, otherAdmin)).toEqual(ALL);
  });

  it('lets an administrator switch their own branch\'s laundry staff on and off, but not change roles', () => {
    expect(staffActionsFor(admin, staffHere)).toEqual({ toggleActive: true, resetPassword: true, changeRole: false });
  });

  it('gives an administrator nothing for other branches or other administrators', () => {
    expect(staffActionsFor(admin, staffElsewhere)).toEqual(NONE);
    expect(staffActionsFor(admin, otherAdmin)).toEqual(NONE);
  });

  it('never offers actions on yourself, a super admin, or a customer', () => {
    expect(staffActionsFor(superAdmin, superAdmin)).toEqual(NONE);
    expect(staffActionsFor(superAdmin, { id: 99, role: 'super_admin' })).toEqual(NONE);
    expect(staffActionsFor(superAdmin, { id: 98, role: 'customer' })).toEqual(NONE);
    expect(staffActionsFor(admin, admin)).toEqual(NONE);
  });

  it('offers laundry staff and customers nothing', () => {
    expect(staffActionsFor({ id: 20, role: 'laundry_staff', branch_id: 5 }, staffHere)).toEqual(NONE);
    expect(staffActionsFor({ id: 21, role: 'customer' }, staffHere)).toEqual(NONE);
  });

  it('copes with missing people', () => {
    expect(staffActionsFor(null, staffHere)).toEqual(NONE);
    expect(staffActionsFor(admin, undefined)).toEqual(NONE);
  });
});
