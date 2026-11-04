const { isStaffRole } = require('../config/orderLifecycle');

const DIFFERENT_BRANCH_ERROR = 'This record belongs to a different branch.';

// A super_admin works across every branch. Everyone else may only touch their
// own branch's records, so a staff account with no branch reaches none of them.
function canAccessBranch(user, branchId) {
  if (user?.role === 'super_admin') return true;
  if (user?.branch_id == null || branchId == null) return false;
  return Number(user.branch_id) === Number(branchId);
}

// An order is visible to the customer who owns it, or to staff at its branch.
// `record` needs user_id and branch_id.
function canViewOrder(user, record) {
  if (record.user_id === user?.id) return true;
  return isStaffRole(user?.role) && canAccessBranch(user, record.branch_id);
}

module.exports = { DIFFERENT_BRANCH_ERROR, canAccessBranch, canViewOrder };
