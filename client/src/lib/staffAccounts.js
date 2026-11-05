// What the signed-in person may do to another staff account. This mirrors the
// server's rules (server/utils/staffRules.js) so the screen only offers actions
// that will work; the server still enforces them, so this is for the interface
// and not for security.
//
//   - Nobody changes their own account here, or a super admin account.
//   - A super admin can switch staff and administrators on or off, reset their
//     passwords, and change roles.
//   - An administrator can switch laundry staff in their own branch on or off and
//     reset their passwords. Roles and administrators are the super admin's.

export const MANAGEABLE_ROLES = ['laundry_staff', 'administrator'];

export function staffActionsFor(actor, target) {
  const none = { toggleActive: false, resetPassword: false, changeRole: false };
  if (!actor || !target) return none;
  if (target.id === actor.id || target.role === 'super_admin' || target.role === 'customer') return none;

  if (actor.role === 'super_admin') {
    return { toggleActive: true, resetPassword: true, changeRole: true };
  }
  if (actor.role === 'administrator') {
    const ownBranchStaff =
      target.role === 'laundry_staff' && actor.branch_id != null && actor.branch_id === target.branch_id;
    return ownBranchStaff ? { toggleActive: true, resetPassword: true, changeRole: false } : none;
  }
  return none;
}

export const STAFF_ROLE_OPTIONS = [
  { value: 'laundry_staff', label: 'Laundry Staff' },
  { value: 'administrator', label: 'Administrator' },
];
