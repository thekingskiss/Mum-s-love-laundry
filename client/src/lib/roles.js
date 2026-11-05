export const STAFF_ROLES = ['laundry_staff', 'administrator', 'super_admin'];
export const ADMIN_ROLES = ['administrator', 'super_admin'];

// Where each role lands after login, and the home of their workspace.
export function workspacePath(role) {
  if (ADMIN_ROLES.includes(role)) return '/admin';
  if (role === 'laundry_staff') return '/staff';
  return '/dashboard';
}
