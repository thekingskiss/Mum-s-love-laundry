import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { installFakeDb } from './helpers/fakeDb';
import { SECRET, tokenFor, answerAccountLookups } from './helpers/accounts';

// Every request here is refused by the role check or by validation, before any
// controller query runs. The only query is the account lookup that requireAuth
// does, which the fake database answers.
let app;
let db;

afterAll(() => db?.restore());

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  db = installFakeDb();
  answerAccountLookups(db);
  const { default: adminRoutes } = await import('../routes/adminRoutes');
  const { default: serviceRoutes } = await import('../routes/serviceRoutes');
  app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/services', serviceRoutes);
});

const SUPER_ADMIN_ONLY = [
  ['post', '/api/admin/staff'],
  ['patch', '/api/admin/currencies/GHS'],
  ['patch', '/api/services/1'],
  ['post', '/api/services/1/promo'],
  ['post', '/api/admin/branches'],
  ['patch', '/api/admin/branches/1'],
  ['get', '/api/admin/audit-log'],
];

describe('super admin only actions', () => {
  it.each(SUPER_ADMIN_ONLY)('refuses an administrator: %s %s', async (method, path) => {
    const res = await request(app)[method](path).set('Authorization', `Bearer ${tokenFor('administrator')}`).send({});
    expect(res.status).toBe(403);
  });

  it.each(SUPER_ADMIN_ONLY)('refuses laundry staff: %s %s', async (method, path) => {
    const res = await request(app)[method](path).set('Authorization', `Bearer ${tokenFor('laundry_staff')}`).send({});
    expect(res.status).toBe(403);
  });
});

// Each request below is invalid, so it stops at validation (400) without a
// database. Reaching validation is what proves the role check let it through.
describe('managing the price list', () => {
  const asRole = (role, method, path) =>
    request(app)[method](path).set('Authorization', `Bearer ${tokenFor(role)}`);

  it.each(['administrator', 'super_admin'])('lets %s through to edit and add items', async (role) => {
    expect((await asRole(role, 'post', '/api/admin/items').send({})).status).toBe(400);
    expect((await asRole(role, 'patch', '/api/admin/items/1').send({ unit_price: -1 })).status).toBe(400);
  });

  // These bodies are valid, so the only thing that can stop them is the role check.
  it.each(['laundry_staff', 'customer'])('refuses to let %s change anything', async (role) => {
    const newItem = { category: 'Towels', item_name: 'Mat', unit_price: 5 };
    expect((await asRole(role, 'post', '/api/admin/items').send(newItem)).status).toBe(403);
    expect((await asRole(role, 'patch', '/api/admin/items/1').send({ unit_price: 5 })).status).toBe(403);
    expect((await asRole(role, 'patch', '/api/admin/items/1').send({ item_name: 'Mat' })).status).toBe(403);
    expect((await asRole(role, 'patch', '/api/admin/items/1').send({ is_active: false })).status).toBe(403);
  });

  // Getting past the role check reaches the database, which this file doesn't
  // need to be running: any answer other than 403 means staff were let through.
  it('lets laundry staff read the full list', async () => {
    expect((await asRole('laundry_staff', 'get', '/api/admin/items')).status).not.toBe(403);
  });

  it('keeps the staff list from customers', async () => {
    expect((await asRole('customer', 'get', '/api/admin/items')).status).toBe(403);
  });

  it.each([
    ['a blank price', { unit_price: '' }, 'Enter a price greater than 0.'],
    ['a price of zero', { unit_price: 0 }, 'Enter a price greater than 0.'],
    ['a negative price', { unit_price: -5 }, 'Enter a price greater than 0.'],
    ['text as a price', { unit_price: 'free' }, 'Enter a price greater than 0.'],
    ['a price too large to store', { unit_price: 100000000 }, 'Enter a price greater than 0.'],
    ['half a range', { price_min: 10 }, 'Enter a minimum and maximum price greater than 0.'],
    ['a blank range', { price_min: '', price_max: '' }, 'Enter a minimum and maximum price greater than 0.'],
    ['an upside-down range', { price_min: 20, price_max: 10 }, 'The minimum price cannot be more than the maximum.'],
    ['a fixed price and a range', { unit_price: 5, price_min: 1, price_max: 2 }, 'Provide either a fixed price or a price range, not both.'],
    ['a blank name', { item_name: '   ' }, 'Enter an item name.'],
    ['a blank category', { category: '' }, 'Enter a category.'],
    ['a non-boolean active flag', { is_active: 'yes' }, 'is_active must be true or false.'],
  ])('rejects %s when editing', async (_label, body, message) => {
    const res = await asRole('administrator', 'patch', '/api/admin/items/1').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });

  it('rejects an item id that is not a number', async () => {
    const res = await asRole('administrator', 'patch', '/api/admin/items/abc').send({ unit_price: 5 });
    expect(res.status).toBe(400);
  });

  it.each([
    ['no price', { category: 'Towels', item_name: 'Mat' }, 'Enter a fixed price or a price range.'],
    ['no name', { category: 'Towels', unit_price: 5 }, 'A category and item name are required.'],
    ['no category', { item_name: 'Mat', unit_price: 5 }, 'A category and item name are required.'],
    ['a name that is not text', { category: 'Towels', item_name: 5, unit_price: 5 }, 'A category and item name are required.'],
  ])('rejects a new item with %s', async (_label, body, message) => {
    const res = await asRole('administrator', 'post', '/api/admin/items').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });
});

describe('admin overview', () => {
  it.each(['/api/admin/overview', '/api/admin/overview/activity'])('refuses laundry staff and customers: %s', async (path) => {
    for (const role of ['laundry_staff', 'customer']) {
      const res = await request(app).get(path).set('Authorization', `Bearer ${tokenFor(role)}`);
      expect(res.status).toBe(403);
    }
  });

  it.each(['/api/admin/overview', '/api/admin/overview/activity'])('requires a login: %s', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });
});
