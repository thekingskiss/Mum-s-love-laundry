const { DIFFERENT_BRANCH_ERROR } = require('./branchAccess');

// Roles a staff account can be given through the API. Super admin accounts are
// never created or changed here, so the shop can't lock itself out by demoting
// or deactivating its last super admin.
const MANAGEABLE_ROLES = ['laundry_staff', 'administrator'];

// Decides whether `actor` may make `change` to the `target` account. Returns
// null when allowed, or { status, error } describing the refusal.
//
//   change.type: 'role' | 'branch' | 'active' | 'password'
//   change.role / change.branchId: the new value, for 'role' / 'branch'
//
// Super admins can manage laundry staff and administrators. Administrators can
// only switch laundry staff in their own branch on or off and reset their
// passwords; roles and branches stay with the super admin.
function checkStaffChange({ actor, target, change }) {
  if (!target || target.role === 'customer') {
    return { status: 404, error: 'Staff account not found.' };
  }
  if (target.id === actor.id) {
    return { status: 400, error: "You can't change your own account here. Ask a super admin, or use the profile and forgot-password pages." };
  }
  if (target.role === 'super_admin') {
    return { status: 403, error: "Super admin accounts can't be changed here." };
  }

  if (actor.role === 'administrator') {
    if (target.role !== 'laundry_staff') {
      return { status: 403, error: 'Only a super admin can manage administrator accounts.' };
    }
    if (!actor.branch_id || actor.branch_id !== target.branch_id) {
      return { status: 403, error: DIFFERENT_BRANCH_ERROR };
    }
    if (change.type === 'role' || change.type === 'branch') {
      return { status: 403, error: 'Only a super admin can change roles or branches.' };
    }
  } else if (actor.role !== 'super_admin') {
    return { status: 403, error: 'You do not have permission to perform this action.' };
  }

  if (change.type === 'role' && !MANAGEABLE_ROLES.includes(change.role)) {
    return { status: 400, error: `role must be one of: ${MANAGEABLE_ROLES.join(', ')}` };
  }
  if (change.type === 'branch' && !Number.isInteger(change.branchId)) {
    return { status: 400, error: 'branch_id must be a branch id.' };
  }
  return null;
}

module.exports = { MANAGEABLE_ROLES, checkStaffChange };
