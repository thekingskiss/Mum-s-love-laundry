import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole, requireAdmin, requireStaff } from '../middleware/auth';

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
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('rejects a request with no Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a malformed Authorization header (no Bearer scheme)', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a malformed/garbage token', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-jwt' } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret', () => {
    const token = jwt.sign({ id: 1, role: 'customer' }, 'a-different-secret');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the decoded user and calls next() for a valid token', () => {
    const token = jwt.sign(
      { id: 1, email: 'a@b.com', location_zone: 'Koforidua', role: 'customer' },
      process.env.JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(req.user).toEqual({ id: 1, email: 'a@b.com', location_zone: 'Koforidua', role: 'customer', branch_id: null });
    expect(next).toHaveBeenCalledOnce();
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
