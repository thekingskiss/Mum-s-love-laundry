import { test, expect } from '@playwright/test';
import { USERS } from '../env.js';
import { logIn, newSession } from './helpers.js';

// Messages with files, end to end: an administrator composes one in the real
// composer, the real API stores the files, and the customer sees them in their
// own notifications. The test API has no mail or SMS settings (see env.js), so
// nothing here can email or text anyone.
test.describe.configure({ mode: 'serial' });

// A real 1x1 PNG, so the browser can actually decode it.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
// Starts with an ID3 tag, which is how the server recognises an MP3.
const MP3 = Buffer.concat([Buffer.from('ID3\u0003\u0000\u0000\u0000\u0000\u0000\u0000'), Buffer.alloc(64)]);

async function startMessage(page, { title, body }) {
  await page.goto('/admin?tab=messages');
  await expect(page.getByRole('heading', { name: 'Send a Message' })).toBeVisible();

  await page.getByRole('button', { name: 'Individual Customer' }).click();
  await page.getByPlaceholder(/search by name/i).fill(USERS.customer.name);
  await page.getByRole('button', { name: new RegExp(USERS.customer.name) }).click();

  await page.getByPlaceholder('Title').fill(title);
  if (body) await page.getByPlaceholder(/^Message/).fill(body);
}

test('an administrator sends a photo, a voice note and a PDF, and the customer sees and can open them', async ({ browser, request }) => {
  const title = `Your order photos ${Date.now()}`;

  // --- the administrator sends it
  const admin = await newSession(browser);
  try {
    await logIn(admin.page, USERS.admin, { landing: /\/admin$/ });
    await startMessage(admin.page, { title, body: 'Photos and the receipt are attached.' });

    await admin.page.getByLabel(/^In-app message/).check();
    await admin.page.getByTestId('attachment-input').setInputFiles([
      { name: 'before.png', mimeType: 'image/png', buffer: PNG },
      { name: 'voice-note.mp3', mimeType: 'audio/mpeg', buffer: MP3 },
      { name: 'receipt.pdf', mimeType: 'application/pdf', buffer: PDF },
    ]);
    const attachments = admin.page.getByRole('list', { name: 'Attachments' });
    await expect(attachments.getByRole('listitem')).toHaveCount(3);

    await admin.page.getByRole('button', { name: 'Send Message' }).click();
    await expect(admin.page.getByText(/Message sent to E2E Customer\./)).toBeVisible();
    await expect(admin.page.getByText(/3 attachments included/)).toBeVisible();
    // The form is cleared for the next message.
    await expect(attachments).toHaveCount(0);
  } finally {
    await admin.context.close();
  }

  // --- the customer sees it on a desktop-sized screen, on the Notifications page
  const customer = await newSession(browser);
  try {
    await logIn(customer.page, USERS.customer, { landing: /\/dashboard$/ });
    // The overview counts it as unread.
    await expect(customer.page.getByRole('link', { name: /Notifications\s*1\s*Unread/ })).toBeVisible();

    await customer.page.getByRole('link', { name: 'Notifications' }).first().click();
    await expect(customer.page).toHaveURL(/tab=notifications/);
    await expect(customer.page.getByText(title)).toBeVisible();
    const image = customer.page.getByAltText('before.png');
    await expect(image).toBeVisible();
    // Decoded by the browser, not just present in the page.
    await expect.poll(() => image.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(customer.page.getByLabel('voice-note.mp3')).toBeVisible();
    const pdfLink = customer.page.getByRole('link', { name: /receipt\.pdf/ });
    await expect(pdfLink).toBeVisible();

    // The stored files are really served, with the right type and no sniffing.
    const imageResponse = await request.get(await image.getAttribute('src'));
    expect(imageResponse.status()).toBe(200);
    expect(imageResponse.headers()['content-type']).toContain('image/png');
    expect(imageResponse.headers()['x-content-type-options']).toBe('nosniff');
    const pdfResponse = await request.get(await pdfLink.getAttribute('href'));
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
    expect(Buffer.compare(await pdfResponse.body(), PDF)).toBe(0);
  } finally {
    await customer.context.close();
  }

  // --- and on a phone, in the notification bell
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const phone = await phoneContext.newPage();
    await logIn(phone, USERS.customer, { landing: /\/dashboard$/ });
    await phone.getByRole('button', { name: 'Notifications' }).click();
    await expect(phone.getByText(title)).toBeVisible();
    await expect(phone.getByAltText('before.png')).toBeVisible();
    await expect(phone.getByLabel('voice-note.mp3')).toBeVisible();
    await expect(phone.getByRole('link', { name: /receipt\.pdf/ })).toBeVisible();
  } finally {
    await phoneContext.close();
  }
});

test('a file on its own can be the whole message', async ({ browser }) => {
  const title = `Receipt only ${Date.now()}`;
  const admin = await newSession(browser);
  const customer = await newSession(browser);
  try {
    await logIn(admin.page, USERS.admin, { landing: /\/admin$/ });
    await startMessage(admin.page, { title });
    await admin.page.getByLabel(/^In-app message/).check();
    await admin.page.getByTestId('attachment-input').setInputFiles({ name: 'only.pdf', mimeType: 'application/pdf', buffer: PDF });
    await admin.page.getByRole('button', { name: 'Send Message' }).click();
    await expect(admin.page.getByText(/1 attachment included/)).toBeVisible();

    await logIn(customer.page, USERS.customer, { landing: /\/dashboard$/ });
    await customer.page.goto('/dashboard?tab=notifications');
    await expect(customer.page.getByText(title)).toBeVisible();
    await expect(customer.page.getByText('Shared 1 attachment with you.')).toBeVisible();
    await expect(customer.page.getByRole('link', { name: /only\.pdf/ })).toBeVisible();
  } finally {
    await admin.context.close();
    await customer.context.close();
  }
});

test('an unsupported file is refused with a reason, and nothing is sent', async ({ browser }) => {
  const admin = await newSession(browser);
  try {
    await logIn(admin.page, USERS.admin, { landing: /\/admin$/ });
    await startMessage(admin.page, { title: 'Should not send', body: 'x' });
    await admin.page.getByTestId('attachment-input').setInputFiles({ name: 'page.html', mimeType: 'text/html', buffer: Buffer.from('<script>1</script>') });
    await expect(admin.page.getByRole('alert')).toContainText('page.html');
    await expect(admin.page.getByRole('alert')).toContainText('not a supported file type');
    await expect(admin.page.getByRole('list', { name: 'Attachments' })).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});

test('a direct email says plainly that email is not set up, instead of pretending it was sent', async ({ browser }) => {
  const admin = await newSession(browser);
  try {
    await logIn(admin.page, USERS.admin, { landing: /\/admin$/ });
    await startMessage(admin.page, { title: 'Direct email', body: 'Hello' });
    await admin.page.getByLabel(/^Email only/).check();
    await admin.page.getByRole('button', { name: 'Send Email' }).click();
    await expect(admin.page.getByRole('alert')).toContainText('Email is not set up on the server');
    await expect(admin.page.getByText(/emailed to/i)).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});

test('only administrators get the composer', async ({ browser }) => {
  const staff = await newSession(browser);
  try {
    await logIn(staff.page, USERS.staff, { landing: /\/staff$/ });
    await staff.page.goto('/staff?tab=messages');
    await expect(staff.page.getByRole('heading', { name: /Contact Messages/ })).toBeVisible();
    await expect(staff.page.getByRole('heading', { name: 'Send a Message' })).toHaveCount(0);
  } finally {
    await staff.context.close();
  }
});
