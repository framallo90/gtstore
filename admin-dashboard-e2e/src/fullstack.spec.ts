import { test, expect } from '@playwright/test';

const FULLSTACK_ENABLED = process.env['GT_FULLSTACK_E2E'] === '1';

test.describe('Admin Dashboard (fullstack)', () => {
  test.skip(!FULLSTACK_ENABLED, 'Set GT_FULLSTACK_E2E=1 to run fullstack e2e.');

  test('admin can login and sees dashboard', async ({ page }) => {
    const email = process.env['ADMIN_EMAIL'];
    const password = process.env['ADMIN_PASSWORD'];
    test.skip(!email || !password, 'ADMIN_EMAIL/ADMIN_PASSWORD env vars are required for this test.');

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Panel de administracion', level: 2 })).toBeVisible();

    await page.getByLabel('Usuario admin o email').fill(email);
    await page.getByLabel('Password').fill(password);
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();

    const loginResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' && res.url().includes('/api/auth/admin/login'),
      { timeout: 15_000 },
    );

    await page.getByRole('button', { name: 'Entrar' }).click();

    const loginRes = await loginResponsePromise;
    expect(loginRes.status()).toBe(201);

    await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ordenes', level: 3 })).toBeVisible();
  });
});
