import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { installFakeDb } from './helpers/fakeDb';
import { SECRET, tokenFor, answerAccountLookups } from './helpers/accounts';
import { answerNotifications } from './helpers/app';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = Buffer.from('%PDF-1.7\n%%EOF');
const MP3 = Buffer.from('ID3\u0003\u0000\u0000\u0000\u0000\u0000\u0000');

let app;
let db;
const storedFiles = [];

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  db = installFakeDb();
  answerAccountLookups(db);
  answerNotifications(db);
  db.on(/INSERT INTO audit_log/, []);
  db.on(/SELECT id, email, phone_number FROM users WHERE id = \$1/, [{ id: 7, email: 'ama@example.com', phone_number: '0240000000' }]);
  db.on(/SELECT id, email, phone_number FROM users WHERE role = 'customer'/, [
    { id: 7, email: 'ama@example.com', phone_number: '0240000000' },
    { id: 8, email: 'kofi@example.com', phone_number: '0241111111' },
  ]);
  const { default: adminRoutes } = await import('../routes/adminRoutes');
  const { notFound, errorHandler } = await import('../middleware/errorHandler');
  app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use(notFound);
  app.use(errorHandler);
});

afterEach(() => {
  db.calls.length = 0;
});

afterAll(() => {
  db?.restore();
  // Uploads go to the real local folder when Cloudinary isn't configured.
  for (const url of storedFiles) fs.rmSync(path.join(__dirname, '..', url), { force: true });
});

const admin = () => ({ Authorization: `Bearer ${tokenFor('administrator')}` });
const notificationInserts = () => db.calls.filter((c) => /INSERT INTO notifications/.test(c.sql));

// The route has a real limit of 10 sends per 15 minutes, so this file keeps to
// 10 requests that reach the limiter (role-check refusals happen before it).
describe('POST /api/admin/messages', () => {
  it('still accepts a plain JSON text message', async () => {
    const res = await request(app).post('/api/admin/messages').set(admin()).send({ title: 'Hello', body: 'Your order is ready', customer_id: 7 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ recipient_count: 1, attachment_count: 0, email_requested: false });
    const [insert] = notificationInserts();
    expect(insert.params[3]).toBe('Your order is ready');
    expect(JSON.parse(insert.params[4])).toEqual([]);
  });

  it('keeps the old send_email flag working as an in-app + email copy', async () => {
    const res = await request(app).post('/api/admin/messages').set(admin()).send({ title: 'Hi', body: 'Body', customer_id: 7, send_email: true });
    expect(res.status).toBe(200);
    expect(res.body.email_requested).toBe(true);
    // in-app row plus the email-channel row
    expect(notificationInserts()).toHaveLength(2);
  });

  it('stores image, audio and document attachments with the in-app message', async () => {
    const res = await request(app)
      .post('/api/admin/messages')
      .set(admin())
      .field('title', 'Photos and receipt')
      .field('body', 'See attached')
      .field('customer_id', '7')
      .field('delivery', 'in_app')
      .attach('attachments', PNG, 'before.png')
      .attach('attachments', MP3, 'voice.mp3')
      .attach('attachments', PDF, 'receipt.pdf');
    expect(res.status).toBe(200);
    expect(res.body.attachment_count).toBe(3);

    const [insert] = notificationInserts();
    const saved = JSON.parse(insert.params[4]);
    storedFiles.push(...saved.map((a) => a.url));
    expect(saved.map((a) => [a.kind, a.name])).toEqual([
      ['image', 'before.png'],
      ['audio', 'voice.mp3'],
      ['document', 'receipt.pdf'],
    ]);
    for (const a of saved) {
      expect(a.url).toMatch(/^\/uploads\/messages\/[0-9a-f-]+\.\w+$/);
      expect(fs.existsSync(path.join(__dirname, '..', a.url))).toBe(true);
    }
  });

  it('allows a message that is only an attachment', async () => {
    const res = await request(app)
      .post('/api/admin/messages')
      .set(admin())
      .field('title', 'Receipt')
      .field('customer_id', '7')
      .attach('attachments', PDF, 'receipt.pdf');
    expect(res.status).toBe(200);
    const [insert] = notificationInserts();
    storedFiles.push(...JSON.parse(insert.params[4]).map((a) => a.url));
    expect(insert.params[3]).toBe('Shared 1 attachment with you.');
  });

  it('rejects a message with neither text nor files', async () => {
    const res = await request(app).post('/api/admin/messages').set(admin()).send({ title: 'Empty', customer_id: 7 });
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported file and stores nothing', async () => {
    const bad = await request(app)
      .post('/api/admin/messages')
      .set(admin())
      .field('title', 'x')
      .field('body', 'y')
      .field('customer_id', '7')
      .attach('attachments', PNG, 'fine.png')
      .attach('attachments', Buffer.from('<script>alert(1)</script>'), 'page.html');
    expect(bad.status).toBe(400);
    expect(notificationInserts()).toHaveLength(0);
  });

  it('rejects more than five attachments', async () => {
    let req = request(app).post('/api/admin/messages').set(admin()).field('title', 'x').field('body', 'y').field('customer_id', '7');
    for (let i = 0; i < 6; i += 1) req = req.attach('attachments', PNG, `p${i}.png`);
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/up to 5/);
  });

  it('refuses a direct email when the server has no mail settings, instead of faking success', async () => {
    const toAddress = await request(app).post('/api/admin/messages').set(admin()).send({ title: 'Hi', body: 'Body', recipient_email: 'someone@example.com' });
    expect(toAddress.status).toBe(503);
    expect(notificationInserts()).toHaveLength(0);
  });

  it('validates a typed email address and the delivery mode', async () => {
    const badAddress = await request(app).post('/api/admin/messages').set(admin()).send({ title: 'Hi', body: 'Body', recipient_email: 'nope' });
    expect(badAddress.status).toBe(400);
    const badMode = await request(app).post('/api/admin/messages').set(admin()).send({ title: 'Hi', body: 'Body', customer_id: 7, delivery: 'pigeon' });
    expect(badMode.status).toBe(400);
  });

  it('is administrators only', async () => {
    const customer = await request(app).post('/api/admin/messages').set({ Authorization: `Bearer ${tokenFor('customer')}` }).send({ title: 'x', body: 'y' });
    expect(customer.status).toBe(403);
    const staff = await request(app).post('/api/admin/messages').set({ Authorization: `Bearer ${tokenFor('laundry_staff')}` }).send({ title: 'x', body: 'y' });
    expect(staff.status).toBe(403);
  });
});
