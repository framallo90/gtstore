import { test, expect } from '@playwright/test';

const FULLSTACK_ENABLED = process.env['GT_FULLSTACK_E2E'] === '1';

function uniqueEmail(prefix: string) {
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}-${Date.now()}-${rand}@example.com`;
}

test.describe('Storefront (fullstack)', () => {
  test.skip(!FULLSTACK_ENABLED, 'Set GT_FULLSTACK_E2E=1 to run fullstack e2e.');

  test('guest can browse catalog and checkout', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Colecciona antes de que desaparezca del stock' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Catalogo', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Catalogo' })).toBeVisible();

    // Seeded products should exist (prisma seed).
    await expect(page.getByRole('heading', { name: 'Dune' })).toBeVisible();
    await page
      .locator('article.product-card', { has: page.getByRole('heading', { name: 'Dune' }) })
      .getByRole('button', { name: 'Agregar' })
      .click();

    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

    await page.getByRole('button', { name: 'Continuar a envio' }).click();
    await page.getByLabel('Ciudad').fill('Rosario');
    await page.getByLabel('Codigo postal').fill('2000');
    await page.getByRole('button', { name: 'Continuar a pago' }).click();

    // Guest buyer details.
    const guestEmail = uniqueEmail('guest');
    await page.getByLabel('Email', { exact: true }).fill(guestEmail);
    await page.getByLabel('Nombre').fill('E2E');
    await page.getByLabel('Apellido').fill('Guest');

    const checkoutResponse = page.waitForResponse((res) => {
      return (
        res.url().includes('/api/orders/guest/checkout') &&
        (res.status() === 200 || res.status() === 201 || res.status() === 503)
      );
    });
    await page.getByRole('button', { name: 'Comprar como invitado' }).click();
    const response = await checkoutResponse;

    if (response.status() === 200 || response.status() === 201) {
      await expect(page).toHaveURL(/\/(\?.*)?$/);
      return;
    }

    await expect(
      page.getByText('No se pudo cotizar envio con Andreani. Verifica ciudad/CP o intenta mas tarde.'),
    ).toBeVisible();
  });

  test('register syncs guest cart to server', async ({ page }) => {
    await page.goto('/catalog');
    await expect(page.getByRole('heading', { name: 'Catalogo' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Watchmen' })).toBeVisible();
    await page
      .locator('article.product-card', { has: page.getByRole('heading', { name: 'Watchmen' }) })
      .getByRole('button', { name: 'Agregar' })
      .click();

    // Register with returnUrl to cart to observe sync immediately.
    await page.goto('/register?returnUrl=/cart');
    await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();

    const email = uniqueEmail('user');
    const password = 'password123';

    await page.getByLabel('Nombre').fill('E2E');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);

    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // Should land in cart and show server cart line.
    await expect(page.getByRole('heading', { name: 'Carrito' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Perfil' })).toBeVisible();
    await expect(page.getByRole('main').getByText('Watchmen')).toBeVisible();
  });
});
