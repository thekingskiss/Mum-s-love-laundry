import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole, requireAdmin, requireStaff } from '../middleware/auth';
import { installFakeDb } from './helpers/fakeDb';

// Uses the real jsonwebtoken library rather than mocking it — jsonwebtoken
// is an npm dependency required from a CommonJS file (middleware/auth.js),
// and Vitest's module mocking doesn't reliably intercept that require()
// chain the way it does for local relative-path modules. Signing/verifying
// real tokens sidesteps the issue and is arguably a better test anyway.
function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth', () => {
  let db;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    db = installFakeDb();
  });

  afterEach(() => db.restore());

  const bearer = (payload, secret = 'test-secret', options = {}) => ({
    headers: { authorization: `Bearer ${jwt.sign(payload, secret, options)}` },
  });

  const account = (changes = {}) => ({
    id: 1, email: 'a@b.com', location_zone: 'Koforidua', role: 'customer', branch_id: null,
    is_active: true, password_changed_at: null, ...changes,
  });

  it('rejects a request with no Authorization header', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAuth({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a malformed Authorization header (no Bearer scheme)', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAuth({ headers: { authorization: 'Basic abc123' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a malformed/garbage token without touching the database', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAuth({ headers: { authorization: 'Bearer not-a-real-jwt' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(db.calls).toHaveLength(0);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAuth(bearer({ id: 1, role: 'customer' }, 'a-different-secret'), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the account from the database and calls next() for a valid token', async () => {
    db.on(/FROM users WHERE id/, [account()]);
    const req = bearer({ id: 1 });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(req.user).toEqual({ id: 1, email: 'a@b.com', location_zone: 'Koforidua', role: 'customer', branch_id: null });
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('uses the role in the database, not the one baked into an older token', async () => {
    // The token still says administrator, but the account was demoted since.
    db.on(/FROM users WHERE id/, [account({ role: 'laundry_staff', branch_id: 2 })]);
    const req = bearer({ id: 1, role: 'administrator', branch_id: 9 });

    await requireAuth(req, mockRes(), vi.fn());

    expect(req.user.role).toBe('laundry_staff');
    expect(req.user.branch_id).toBe(2);
  });

  it('refuses a deactivated account even though its token is still valid', async () => {
    db.on(/FROM users WHERE id/, [account({ is_active: false })]);
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(bearer({ id: 1 }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses a token for an account that no longer exists', async () => {
    db.on(/FROM users WHERE id/, []);
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(bearer({ id: 99 }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses a token issued before the last password change', async () => {
    const issued = Math.floor(Date.now() / 1000) - 3600;
    db.on(/FROM users WHERE id/, [account({ password_changed_at: new Date().toISOString() })]);
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(bearer({ id: 1, iat: issued }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Your password changed. Please log in again.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a token issued after the last password change', async () => {
    const changed = new Date(Date.now() - 3600 * 1000).toISOString();
    db.on(/FROM users WHERE id/, [account({ password_changed_at: changed })]);
    const next = vi.fn();

    await requireAuth(bearer({ id: 1 }), mockRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('passes a database failure to the error handler instead of letting the request through', async () => {
    db.on(/FROM users WHERE id/, () => new Error('connection lost'));
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(bearer({ id: 1 }), res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'connection lost' }));
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireRole / requireAdmin / requireStaff', () => {
  it('rejects a role not in the allowed list', () => {
    const req = { user: { role: 'customer' } };
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a role in the allowed list', () => {
    const req = { user: { role: 'administrator' } };
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireStaff allows laundry_staff but requireAdmin does not', () => {
    const req = { user: { role: 'laundry_staff' } };
    const staffRes = mockRes();
    const adminRes = mockRes();
    const next = vi.fn();

    requireStaff(req, staffRes, next);
    requireAdmin(req, adminRes, vi.fn());

    expect(next).toHaveBeenCalledOnce();
    expect(adminRes.status).toHaveBeenCalledWith(403);
  });

  it('requireRole composes an arbitrary allow-list', () => {
    const onlySuperAdmin = requireRole('super_admin');
    const req = { user: { role: 'administrator' } };
    const res = mockRes();
    const next = vi.fn();

    onlySuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
