import { expect } from '@playwright/test';
import { PASSWORD } from '../env.js';

// Signs in through the real login form and waits for the landing page.
export async function logIn(page, user, { password = PASSWORD, landing } = {}) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  if (landing) await expect(page).toHaveURL(landing);
}

// A fresh browser context, so two people can be signed in at the same time.
export async function newSession(browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

export function staffRow(page, name) {
  return page.getByRole('row').filter({ hasText: name });
}
