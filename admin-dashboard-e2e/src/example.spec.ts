import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

function fakeJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

test('has title', async ({ page }) => {
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Invalid refresh token',
        error: 'Unauthorized',
        statusCode: 401,
      }),
    });
  });

  await page.goto('/login');
  await expect(page.locator('h1')).toContainText('Admin Dashboard');
});

test('shows dashboard summary when authenticated (mocked API)', async ({ page }) => {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  const token = fakeJwt({ sub: 'u1', email: 'admin@x.com', role: 'ADMIN', exp });

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Invalid refresh token',
        error: 'Unauthorized',
        statusCode: 401,
      }),
    });
  });

  await page.route('**/api/auth/admin/login', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'u1',
          email: 'admin@x.com',
          firstName: 'Admin',
          lastName: 'Test',
          role: 'ADMIN',
        },
        accessToken: token,
      }),
    });
  });

  await page.route(/\/api\/errors\/recent(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route(/\/api\/audit\/recent(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route('**/api/orders/admin/dashboard-summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ordersCount: 12,
        revenue: 123.45,
        lowStockProducts: [{ id: 'p1', title: 'Dune', stock: 2 }],
      }),
    });
  });

  await page.route('**/api/analytics/admin/summary?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
        days: 7,
        totalEvents: 42,
        uniqueVisitors: 10,
        uniqueSessions: 14,
        byName: [
          { name: 'page_view', count: 20 },
          { name: 'add_to_cart', count: 8 },
        ],
        funnel: {
          addToCart: 8,
          beginCheckout: 5,
          purchaseSuccess: 2,
          rates: { beginCheckoutPerAddToCart: 0.625, purchasePerBeginCheckout: 0.4 },
        },
        devices: [
          { deviceClass: 'mobile', count: 6 },
          { deviceClass: 'desktop', count: 4 },
        ],
        timeseries: [
          { day: '2026-02-07', pageViews: 3, addToCart: 1, beginCheckout: 1, purchaseSuccess: 0 },
          { day: '2026-02-08', pageViews: 4, addToCart: 2, beginCheckout: 1, purchaseSuccess: 1 },
          { day: '2026-02-09', pageViews: 2, addToCart: 1, beginCheckout: 1, purchaseSuccess: 0 },
        ],
        topProducts: {
          addToCart: [{ productId: 'p1', title: 'Dune', type: 'BOOK', count: 2 }],
          productView: [{ productId: 'p1', title: 'Dune', type: 'BOOK', count: 5 }],
        },
      }),
    });
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@x.com');
  await page.getByLabel('Password').fill('password123');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  const loginResponse = page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' &&
      res.url().includes('/api/auth/admin/login') &&
      res.status() === 201,
  );
  await page.getByRole('button', { name: 'Entrar' }).click();
  await loginResponse;
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ordenes' })).toBeVisible();
  await expect(page.getByText(/^12$/)).toBeVisible();
  const lowStockCard = page
    .getByRole('heading', { name: 'Sin stock / stock bajo' })
    .locator('..');
  await expect(lowStockCard.getByText('Dune')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Visitantes/ })).toBeVisible();
  await expect(page.getByText(/^10$/)).toBeVisible();
});
