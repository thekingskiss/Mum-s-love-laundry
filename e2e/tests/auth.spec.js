import { test, expect } from '@playwright/test';
import { USERS } from '../env.js';
import { logIn } from './helpers.js';

test.describe('signing in', () => {
  test('a customer logs in and reaches their dashboard', async ({ page }) => {
    await logIn(page, USERS.customer, { landing: /\/dashboard$/ });
    // The session is saved, so a reload keeps them signed in.
    expect(await page.evaluate(() => localStorage.getItem('mll_token'))).toBeTruthy();
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('a wrong password is refused with a clear message', async ({ page }) => {
    await logIn(page, USERS.customer, { password: 'not-the-password' });
    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('staff land in the staff workspace and administrators in the admin workspace', async ({ browser }) => {
    for (const [user, landing] of [[USERS.staff, /\/staff$/], [USERS.admin, /\/admin$/], [USERS.superAdmin, /\/admin$/]]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await logIn(page, user, { landing });
      await context.close();
    }
  });

  test('a signed-out visitor is sent to the login page instead of a private page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a customer cannot open the admin workspace', async ({ page }) => {
    await logIn(page, USERS.customer, { landing: /\/dashboard$/ });
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('the login page can be read in French', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mll_language', 'fr'));
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
    await expect(page.getByLabel('Mot de passe')).toBeVisible();
  });

  test('the login page mirrors to right-to-left in Arabic', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mll_language', 'ar'));
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'مرحبًا بعودتك' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
