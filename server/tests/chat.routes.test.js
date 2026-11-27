import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { installFakeDb } from './helpers/fakeDb';
import { SECRET, answerAccountLookups, tokenFor } from './helpers/accounts';

let app;
let db;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  db = installFakeDb();
  answerAccountLookups(db);
  db.freeze();

  const { default: chatRoutes } = await import('../routes/chatRoutes');
  const { notFound, errorHandler } = await import('../middleware/errorHandler');
  app = express();
  app.use(express.json());
  app.use('/api/chat', chatRoutes);
  app.use(notFound);
  app.use(errorHandler);
});

beforeEach(() => db.reset());
afterAll(() => db.restore());

const chat = (message, token) => {
  const req = request(app).post('/api/chat').send({ message });
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('POST /api/chat', () => {
  it('answers a visitor without a login, and without touching the database for small talk', async () => {
    const res = await chat('hello');
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/Mum’s Helper/);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
    expect(db.callsMatching(/FROM (orders|services|laundry_items)/)).toHaveLength(0);
  });

  it('reads prices from the live price list', async () => {
    db.on(/FROM laundry_items/, [{ category: 'Everyday Wear', item_name: 'Shirt', unit_price: '12.00', price_min: null, price_max: null }]);
    const res = await chat('how much is a shirt');
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('Shirt: GHS 12');
  });

  it('rejects an empty, missing or oversized message', async () => {
    expect((await chat('   ')).status).toBe(400);
    expect((await request(app).post('/api/chat').send({})).status).toBe(400);
    expect((await request(app).post('/api/chat').send({ message: { $ne: 1 } })).status).toBe(400);
    expect((await chat('x'.repeat(501))).status).toBe(400);
  });

  it("looks up only the signed-in customer's own orders", async () => {
    db.on(/FROM orders o/, [{
      id: 5, status: 'quality_check', drop_off_date: '2026-03-02', pickup_date: null,
      storage_location: null, balance_due: '0', items_summary: 'Jeans x2', ready_for_pickup_at: null,
    }]);
    const res = await chat('track my order', tokenFor('customer'));
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('Order #5: Quality Check');
    const [call] = db.callsMatching(/FROM orders o/);
    expect(call.sql).toMatch(/WHERE o\.user_id = \$1/);
    expect(call.params).toEqual([1]);
  });

  it('tells a visitor to log in for order questions', async () => {
    const res = await chat('track my order');
    expect(res.body.reply).toMatch(/log in/i);
    expect(db.callsMatching(/FROM orders o/)).toHaveLength(0);
  });

  it('refuses a bad login instead of treating it as a visitor', async () => {
    expect((await chat('track my order', 'not-a-real-token')).status).toBe(401);
  });
});
