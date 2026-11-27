import { test, expect } from '@playwright/test';
import { USERS } from '../env.js';
import { logIn, newSession } from './helpers.js';

// The chat assistant, end to end: the real widget talks to the real API and the
// throwaway database (see env.js). It is rule-based, so nothing here calls an
// outside service.

const launcher = (page) => page.getByRole('button', { name: 'Chat with us' });
const panel = (page) => page.getByRole('dialog', { name: /Mum.s Helper/ });
const conversation = (page) => panel(page).getByRole('log', { name: 'Conversation' });

async function ask(page, question) {
  await panel(page).getByLabel('Type your question').fill(question);
  await panel(page).getByRole('button', { name: 'Send message' }).click();
}

test('a visitor opens the chat, asks about opening hours, and is asked to log in to track an order', async ({ page }) => {
  await page.goto('/');
  await launcher(page).click();

  await expect(conversation(page)).toContainText(/I.m Mum.s Helper/);

  await ask(page, 'What are your opening hours?');
  await expect(conversation(page)).toContainText('Open 7 days a week, 8am');

  await ask(page, 'Track my order');
  await expect(conversation(page)).toContainText('Please log in so I can look up');
  await expect(panel(page).getByRole('link', { name: 'Log in' })).toBeVisible();

  // Closing brings the launcher back.
  await panel(page).getByRole('button', { name: 'Close chat' }).click();
  await expect(launcher(page)).toBeVisible();
});

test('a suggested question can be tapped instead of typed', async ({ page }) => {
  await page.goto('/');
  await launcher(page).click();

  await panel(page).getByRole('group', { name: 'Suggested questions' }).getByRole('button', { name: 'Opening hours' }).click();
  await expect(conversation(page)).toContainText('Open 7 days a week, 8am');
});

test('a signed-in customer is looked up by their own account, not asked to log in', async ({ browser }) => {
  const customer = await newSession(browser);
  try {
    await logIn(customer.page, USERS.customer, { landing: /\/dashboard/ });
    await launcher(customer.page).click();

    await ask(customer.page, 'Track my order');
    // The test customer has no orders, so the answer is the empty case, and
    // crucially not the "please log in" one.
    await expect(conversation(customer.page)).toContainText('You don’t have any orders with us yet');
    await expect(conversation(customer.page)).not.toContainText('Please log in');
  } finally {
    await customer.context.close();
  }
});

test('on a phone the chat fills the screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await launcher(page).click();

    const box = await panel(page).boundingBox();
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.height)).toBe(844);
    await expect(panel(page).getByLabel('Type your question')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('the chat stays off the staff and admin workspaces', async ({ browser }) => {
  const admin = await newSession(browser);
  try {
    await logIn(admin.page, USERS.admin, { landing: /\/admin$/ });
    await expect(admin.page.getByRole('navigation').first()).toBeVisible();
    await expect(launcher(admin.page)).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});
