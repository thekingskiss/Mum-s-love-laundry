import jwt from 'jsonwebtoken';

// Test accounts shared by the route-level tests. Each role has its own id so a
// fake database can answer "who is account N?" the way the real one would.
export const SECRET = 'test-secret-for-tests-only-0123456789';

export const ACCOUNTS = {
  customer: { id: 1, email: 'customer@example.com', role: 'customer', branch_id: null },
  laundry_staff: { id: 2, email: 'staff@example.com', role: 'laundry_staff', branch_id: 1 },
  administrator: { id: 3, email: 'admin@example.com', role: 'administrator', branch_id: 1 },
  super_admin: { id: 4, email: 'super@example.com', role: 'super_admin', branch_id: null },
};

export function tokenFor(role, overrides = {}) {
  const account = ACCOUNTS[role];
  return jwt.sign({ id: account.id, email: account.email, role, branch_id: account.branch_id, ...overrides }, SECRET);
}

// Teaches a fakeDb to answer the account lookup done by requireAuth.
// `changes` can override a role's row, e.g. { administrator: { is_active: false } }.
export function answerAccountLookups(db, changes = {}) {
  const byId = Object.fromEntries(Object.entries(ACCOUNTS).map(([role, a]) => [a.id, { role, ...a }]));
  // Matches only the requireAuth query (the one that reads password_changed_at).
  db.on(/password_changed_at\s+FROM users WHERE id = \$1/i, (params) => {
    const account = byId[params[0]];
    if (!account) return [];
    return [{
      location_zone: 'Koforidua',
      is_active: true,
      password_changed_at: null,
      ...account,
      ...(changes[account.role] || {}),
    }];
  });
}
