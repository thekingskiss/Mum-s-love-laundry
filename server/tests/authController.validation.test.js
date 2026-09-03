import { describe, it, expect, vi } from 'vitest';
import { register, login } from '../controllers/authController';

// Scoped to validation branches that return before ever touching the
// database, so these run reliably with no test database and no need to
// mock `pool` — Vitest's module mocking doesn't reliably intercept a
// require('../config/db') call made from inside a CommonJS controller file
// in this environment, so DB-touching paths aren't exercised here.
function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('authController.register validation', () => {
  it('rejects registration with missing required fields', async () => {
    const req = { body: { email: 'a@b.com', password: 'password1' } };
    const res = mockRes();
    const next = vi.fn();

    await register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const req = {
      body: {
        email: 'a@b.com',
        password: 'short',
        full_name: 'A B',
        phone_number: '+233200000000',
        location_zone: 'Koforidua',
      },
    };
    const res = mockRes();
    const next = vi.fn();

    await register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('8 characters') }));
  });
});

describe('authController.login validation', () => {
  it('rejects login with missing email', async () => {
    const req = { body: { password: 'password1' } };
    const res = mockRes();
    const next = vi.fn();

    await login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects login with missing password', async () => {
    const req = { body: { email: 'a@b.com' } };
    const res = mockRes();
    const next = vi.fn();

    await login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
