import { test, expect } from '@playwright/test';
import { PASSWORD, USERS } from '../env.js';
import { logIn, newSession, staffRow } from './helpers.js';

// The headline security behaviour, end to end: switching an account off, or
// changing its password, takes effect at once, even for someone who is already
// signed in. These tests change the one shared staff account, so they run in
// order and each puts it back the way it found it.
test.describe.configure({ mode: 'serial' });

async function openStaffAccounts(page) {
  await page.goto('/admin?tab=staff');
  // exact: the page title is "Staff accounts" too, and would match a loose name.
  await expect(page.getByRole('heading', { name: 'Staff Accounts', exact: true })).toBeVisible();
}

async function deactivate(page, name) {
  const row = staffRow(page, name);
  await row.getByRole('button', { name: /^deactivate$/i }).click();
  await row.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expect(row.getByText('Deactivated')).toBeVisible();
}

async function reactivate(page, name) {
  const row = staffRow(page, name);
  await row.getByRole('button', { name: /reactivate/i }).click();
  await expect(row.getByText('Active', { exact: true })).toBeVisible();
}

test('deactivating a signed-in staff member signs them out and blocks them from logging back in', async ({ browser }) => {
  const staff = await newSession(browser);
  const boss = await newSession(browser);
  try {
    // The staff member is working.
    await logIn(staff.page, USERS.staff, { landing: /\/staff$/ });

    // The super admin switches their account off.
    await logIn(boss.page, USERS.superAdmin, { landing: /\/admin$/ });
    await openStaffAccounts(boss.page);
    await deactivate(boss.page, USERS.staff.name);

    // Their very next page load fails: they are back at the login page.
    await staff.page.reload();
    await expect(staff.page).toHaveURL(/\/login$/);

    // And they cannot sign in again, with the correct password.
    await logIn(staff.page, USERS.staff);
    await expect(staff.page.getByText(/has been deactivated/i)).toBeVisible();
    await expect(staff.page).toHaveURL(/\/login$/);

    // Switching them back on lets them in again.
    await reactivate(boss.page, USERS.staff.name);
    await logIn(staff.page, USERS.staff, { landing: /\/staff$/ });
  } finally {
    // Leave the account active for the tests that follow, whatever happened above.
    await openStaffAccounts(boss.page).catch(() => {});
    if (await staffRow(boss.page, USERS.staff.name).getByText('Deactivated').isVisible().catch(() => false)) {
      await reactivate(boss.page, USERS.staff.name);
    }
    await staff.context.close();
    await boss.context.close();
  }
});

test('resetting a password signs the person out everywhere, and only the new password works', async ({ browser }) => {
  const staff = await newSession(browser);
  const boss = await newSession(browser);
  const NEW_PASSWORD = 'A-brand-new-password-9';
  try {
    await logIn(staff.page, USERS.staff, { landing: /\/staff$/ });

    await logIn(boss.page, USERS.superAdmin, { landing: /\/admin$/ });
    await openStaffAccounts(boss.page);
    const row = staffRow(boss.page, USERS.staff.name);
    await row.getByRole('button', { name: /reset password/i }).click();
    await boss.page.getByLabel(`New password for ${USERS.staff.name}`).fill(NEW_PASSWORD);
    await boss.page.getByRole('button', { name: 'Save' }).click();
    await expect(boss.page.getByText(/Password updated for/)).toBeVisible();

    // The old login stops working at once.
    await staff.page.reload();
    await expect(staff.page).toHaveURL(/\/login$/);

    // The old password is refused; the new one works.
    await logIn(staff.page, USERS.staff, { password: PASSWORD });
    await expect(staff.page.getByText('Invalid email or password.')).toBeVisible();
    await logIn(staff.page, USERS.staff, { password: NEW_PASSWORD, landing: /\/staff$/ });

    // Put the original password back so the other tests are not affected.
    await openStaffAccounts(boss.page);
    await staffRow(boss.page, USERS.staff.name).getByRole('button', { name: /reset password/i }).click();
    await boss.page.getByLabel(`New password for ${USERS.staff.name}`).fill(PASSWORD);
    await boss.page.getByRole('button', { name: 'Save' }).click();
    await expect(boss.page.getByText(/Password updated for/)).toBeVisible();
  } finally {
    await staff.context.close();
    await boss.context.close();
  }
});

test('an administrator can manage their own branch\'s staff, but cannot add accounts or touch administrators', async ({ browser }) => {
  const admin = await newSession(browser);
  try {
    await logIn(admin.page, USERS.admin, { landing: /\/admin$/ });
    await openStaffAccounts(admin.page);

    // Their branch's laundry staff can be managed...
    const staffEntry = staffRow(admin.page, USERS.staff.name);
    await expect(staffEntry.getByRole('button', { name: /deactivate/i })).toBeVisible();
    await expect(staffEntry.getByRole('button', { name: /reset password/i })).toBeVisible();

    // ...but not another administrator (themselves, here), and there is no form to add accounts.
    await expect(staffRow(admin.page, USERS.admin.name).getByRole('button', { name: /deactivate/i })).toHaveCount(0);
    await expect(admin.page.getByRole('button', { name: 'Create Account' })).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});

test('only a super admin sees the form to add staff, and a customer cannot reach staff accounts at all', async ({ browser }) => {
  const boss = await newSession(browser);
  const customer = await newSession(browser);
  try {
    await logIn(boss.page, USERS.superAdmin, { landing: /\/admin$/ });
    await openStaffAccounts(boss.page);
    await expect(boss.page.getByRole('button', { name: 'Create Account' })).toBeVisible();

    await logIn(customer.page, USERS.customer, { landing: /\/dashboard$/ });
    await customer.page.goto('/admin?tab=staff');
    await expect(customer.page).toHaveURL(/\/dashboard$/);
  } finally {
    await boss.context.close();
    await customer.context.close();
  }
});
