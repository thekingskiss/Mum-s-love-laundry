import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildApp } from './helpers/app';
import { tokenFor } from './helpers/accounts';

let app;
let db;
let close;

beforeAll(async () => {
  ({ app, db, close } = await buildApp());
});
afterAll(() => close());

// A laundry staff member at branch 1 (the same branch as the test administrator).
const STAFF_ROW = { id: 20, email: 'kofi@example.com', role: 'laundry_staff', branch_id: 1, is_active: true };

function answerStaffLookup(row = STAFF_ROW) {
  // loadStaffTarget's query (no password_changed_at, so requireAuth's is separate).
  db.on(/SELECT id, email, role, branch_id, is_active FROM users WHERE id = \$1/, (params) =>
    (params[0] === row.id ? [row] : [])
  );
}

beforeEach(() => db.reset());

const as = (role) => (method, path) => request(app)[method](path).set('Authorization', `Bearer ${tokenFor(role)}`);

describe('deactivating and reactivating staff', () => {
  it('lets a super admin deactivate staff, and records it', async () => {
    answerStaffLookup();
    db.on(/UPDATE users SET is_active/, (params) => [{ ...STAFF_ROW, is_active: params[0] }]);
    db.on(/INSERT INTO audit_log/, []);

    const res = await as('super_admin')('patch', '/api/admin/staff/20/active').send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.staff.is_active).toBe(false);
    const audit = db.callsMatching(/INSERT INTO audit_log/)[0];
    expect(audit.params).toContain('staff.deactivated');
  });

  it('lets an administrator deactivate staff in their own branch', async () => {
    answerStaffLookup();
    db.on(/UPDATE users SET is_active/, [{ ...STAFF_ROW, is_active: false }]);
    const res = await as('administrator')('patch', '/api/admin/staff/20/active').send({ active: false });
    expect(res.status).toBe(200);
  });

  it('refuses an administrator acting on staff in another branch', async () => {
    answerStaffLookup({ ...STAFF_ROW, branch_id: 2 });
    const res = await as('administrator')('patch', '/api/admin/staff/20/active').send({ active: false });
    expect(res.status).toBe(403);
    expect(db.callsMatching(/UPDATE users/)).toHaveLength(0);
  });

  it('refuses to change an account that belongs to a customer', async () => {
    answerStaffLookup({ ...STAFF_ROW, role: 'customer' });
    const res = await as('super_admin')('patch', '/api/admin/staff/20/active').send({ active: false });
    expect(res.status).toBe(404);
  });

  it('refuses to change your own account', async () => {
    // Test administrator is account 3.
    answerStaffLookup({ ...STAFF_ROW, id: 3, role: 'administrator' });
    const res = await as('administrator')('patch', '/api/admin/staff/3/active').send({ active: false });
    expect(res.status).toBe(400);
  });

  it('rejects a request that does not say true or false', async () => {
    const res = await as('super_admin')('patch', '/api/admin/staff/20/active').send({ active: 'no' });
    expect(res.status).toBe(400);
  });

  it('answers 404 for an id that is not a number', async () => {
    const res = await as('super_admin')('patch', '/api/admin/staff/abc/active').send({ active: false });
    expect(res.status).toBe(404);
  });

  it.each(['laundry_staff', 'customer'])('keeps %s out', async (role) => {
    const res = await as(role)('patch', '/api/admin/staff/20/active').send({ active: false });
    expect(res.status).toBe(403);
  });
});

describe('changing roles and branches', () => {
  it('lets a super admin promote staff to administrator', async () => {
    answerStaffLookup();
    db.on(/UPDATE users SET role/, (params) => [{ ...STAFF_ROW, role: params[0] }]);
    db.on(/INSERT INTO audit_log/, []);

    const res = await as('super_admin')('patch', '/api/admin/staff/20').send({ role: 'administrator' });

    expect(res.status).toBe(200);
    expect(res.body.staff.role).toBe('administrator');
  });

  it('refuses a made-up role', async () => {
    answerStaffLookup();
    const res = await as('super_admin')('patch', '/api/admin/staff/20').send({ role: 'super_admin' });
    expect(res.status).toBe(400);
  });

  it('refuses to move staff to a branch that does not exist', async () => {
    answerStaffLookup();
    db.on(/SELECT id FROM branches WHERE id/, []);
    const res = await as('super_admin')('patch', '/api/admin/staff/20').send({ branch_id: 99 });
    expect(res.status).toBe(400);
  });

  it('asks for something to change', async () => {
    const res = await as('super_admin')('patch', '/api/admin/staff/20').send({});
    expect(res.status).toBe(400);
  });

  it('keeps role changes away from administrators', async () => {
    const res = await as('administrator')('patch', '/api/admin/staff/20').send({ role: 'administrator' });
    expect(res.status).toBe(403);
  });
});

describe('resetting a staff password', () => {
  it('stores a hash, stamps password_changed_at and never returns the password', async () => {
    answerStaffLookup();
    db.on(/UPDATE users SET password_hash/, []);
    db.on(/INSERT INTO audit_log/, []);

    const res = await as('administrator')('post', '/api/admin/staff/20/password').send({ password: 'a-new-password' });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('a-new-password');
    const update = db.callsMatching(/UPDATE users SET password_hash/)[0];
    expect(update.sql).toMatch(/password_changed_at = NOW\(\)/);
    expect(update.params[0]).not.toBe('a-new-password');
    expect(await bcrypt.compare('a-new-password', update.params[0])).toBe(true);
  });

  it('rejects a short password before looking anything up', async () => {
    const res = await as('super_admin')('post', '/api/admin/staff/20/password').send({ password: 'short' });
    expect(res.status).toBe(400);
    expect(db.callsMatching(/SELECT id, email, role/)).toHaveLength(0);
  });
});

describe('a deactivated account is locked out everywhere', () => {
  it('is refused on an ordinary authenticated route', async () => {
    db.first(/password_changed_at\s+FROM users WHERE id/, [
      { id: 2, email: 'staff@example.com', role: 'laundry_staff', branch_id: 1, is_active: false, password_changed_at: null },
    ]);
    const res = await request(app).get('/api/admin/items').set('Authorization', `Bearer ${tokenFor('laundry_staff')}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no longer active/);
  });

  it('is refused at login with a clear message, but only after the password is right', async () => {
    const hash = await bcrypt.hash('right-password', 4);
    db.on(/SELECT \* FROM users WHERE email/, [{ id: 20, email: 'kofi@example.com', password_hash: hash, role: 'laundry_staff', is_active: false }]);

    const wrong = await request(app).post('/api/auth/login').send({ email: 'kofi@example.com', password: 'wrong-password' });
    expect(wrong.status).toBe(401);

    const right = await request(app).post('/api/auth/login').send({ email: 'kofi@example.com', password: 'right-password' });
    expect(right.status).toBe(403);
    expect(right.body.error).toMatch(/deactivated/);
    expect(right.body.token).toBeUndefined();
  });
});
