import { test, expect } from '@playwright/test';

function fakeJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

test('has title', async ({ page }) => {
  await page.context().route('**/api/analytics/events/batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Home page always fetches featured products; mock it to avoid relying on a running API.
  await page.context().route(/\/api\/products(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.goto('/');
  await expect(page.locator('h1')).toContainText('GeekyTreasures');
});

test('renders featured products (mocked API)', async ({ page }) => {
  await page.context().route('**/api/analytics/events/batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.context().route(/\/api\/products(\?.*)?$/, async (route) => {
    const url = route.request().url();
    if (!url.includes('featured=true')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'p1',
          title: 'Dune',
          description: 'Sci-fi',
          author: 'Frank Herbert',
          price: 19.99,
          stock: 10,
          type: 'BOOK',
          isFeatured: true,
        },
      ]),
    });
  });

  await page.goto('/');
  await expect(page.getByText('Dune')).toBeVisible();
});

test('guest can add to cart and sees it in cart (mocked API)', async ({ page }) => {
  await page.context().route('**/api/analytics/events/batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.context().route(/\/api\/products(\?.*)?$/, async (route) => {
    const url = route.request().url();
    if (url.includes('/api/products/p1')) {
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'p1',
          title: 'Dune',
          description: 'Sci-fi',
          author: 'Frank Herbert',
          price: 19.99,
          stock: 10,
          type: 'BOOK',
          isFeatured: true,
        },
      ]),
    });
  });

  await page.context().route('**/api/products/p1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'p1',
        title: 'Dune',
        description: 'Sci-fi',
        author: 'Frank Herbert',
        price: 19.99,
        stock: 10,
        type: 'BOOK',
        isFeatured: true,
      }),
    });
  });

  await page.context().route('**/api/products/lookup', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'p1',
          title: 'Dune',
          description: 'Sci-fi',
          author: 'Frank Herbert',
          price: 19.99,
          stock: 10,
          type: 'BOOK',
          isFeatured: true,
        },
      ]),
    });
  });

  await page.goto('/products/p1');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();

  await page.getByRole('link', { name: /Carrito/ }).click();
  await expect(page).toHaveURL('/cart');
  await expect(page.locator('li.cart-row strong', { hasText: 'Dune' })).toBeVisible();
});

test('login syncs guest cart and keeps returnUrl to checkout (mocked API)', async ({
  page,
}) => {
  await page.context().route('**/api/analytics/events/batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.context().route(/\/api\/products(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'p1',
          title: 'Dune',
          description: 'Sci-fi',
          author: 'Frank Herbert',
          price: 19.99,
          stock: 10,
          type: 'BOOK',
          isFeatured: true,
        },
      ]),
    });
  });

  await page.context().route('**/api/products/p1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'p1',
        title: 'Dune',
        description: 'Sci-fi',
        author: 'Frank Herbert',
        price: 19.99,
        stock: 10,
        type: 'BOOK',
        isFeatured: true,
      }),
    });
  });

  await page.context().route('**/api/products/lookup', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'p1',
          title: 'Dune',
          description: 'Sci-fi',
          author: 'Frank Herbert',
          price: 19.99,
          stock: 10,
          type: 'BOOK',
          isFeatured: true,
        },
      ]),
    });
  });

  await page.context().route('**/api/orders/guest/quote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ subtotal: 19.99, discount: 0, total: 19.99 }),
    });
  });

  await page.context().route('**/api/orders/quote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ subtotal: 19.99, discount: 0, total: 19.99 }),
    });
  });

  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  const token = fakeJwt({ sub: 'u1', email: 'u@x.com', role: 'CUSTOMER', exp });

  await page.context().route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'u1',
          email: 'u@x.com',
          firstName: 'U',
          lastName: 'X',
          role: 'CUSTOMER',
        },
        accessToken: token,
      }),
    });
  });

  await page.context().route('**/api/cart/sync', async (route) => {
    const body = route.request().postDataJSON() as unknown as {
      items?: Array<{ productId: string; quantity: number }>;
    };
    expect(body.items).toEqual([{ productId: 'p1', quantity: 1 }]);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'ci1',
            productId: 'p1',
            quantity: 1,
            product: {
              id: 'p1',
              title: 'Dune',
              description: 'Sci-fi',
              author: 'Frank Herbert',
              price: 19.99,
              stock: 10,
              type: 'BOOK',
              isFeatured: true,
            },
          },
        ],
        total: 19.99,
      }),
    });
  });

  await page.context().route('**/api/cart', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'ci1',
            productId: 'p1',
            quantity: 1,
            product: {
              id: 'p1',
              title: 'Dune',
              description: 'Sci-fi',
              author: 'Frank Herbert',
              price: 19.99,
              stock: 10,
              type: 'BOOK',
              isFeatured: true,
            },
          },
        ],
        total: 19.99,
      }),
    });
  });

  await page.goto('/products/p1');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();

  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fcheckout/);

  await page.getByLabel('Email').fill('u@x.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/checkout');
  await expect(page.locator('li.cart-row strong', { hasText: 'Dune' })).toBeVisible();
});

test('login shows a guided error on invalid credentials (mocked API)', async ({ page }) => {
  await page.context().route('**/api/analytics/events/batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.context().route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Invalid credentials',
        error: 'Unauthorized',
        statusCode: 401,
      }),
    });
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill('noexiste@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('alert')).toContainText('Email o password incorrectos');
  await expect(page.getByRole('link', { name: 'Crear cuenta' })).toBeVisible();
});

test('register shows a guided error when email already exists (mocked API)', async ({
  page,
}) => {
  await page.context().route('**/api/analytics/events/batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.context().route('**/api/auth/register', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Email already exists',
        error: 'Bad Request',
        statusCode: 400,
      }),
    });
  });

  await page.goto('/register?returnUrl=%2Fcheckout');
  await page.getByLabel('Nombre').fill('Test');
  await page.getByLabel('Apellido').fill('User');
  await page.getByLabel('Email', { exact: true }).fill('test@example.com');
  await page.getByLabel('Repetir email', { exact: true }).fill('test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Repetir password').fill('password123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByRole('alert')).toContainText('Ese email ya existe');
  await expect(page.getByText('Este email ya esta registrado')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Iniciar sesion' })).toHaveAttribute(
    'href',
    /returnUrl=%2Fcheckout/,
  );
});

test('drawer is accessible: focus trap + Esc closes (mocked API)', async ({ page }) => {
  await page.context().route('**/api/analytics/events/batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      'gt_guest_cart_v1',
      JSON.stringify([{ productId: 'p1', quantity: 1 }]),
    );
  });

  await page.context().route('**/api/products/lookup', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'p1',
          title: 'Dune',
          description: 'Sci-fi',
          author: 'Frank Herbert',
          price: 19.99,
          stock: 10,
          type: 'BOOK',
          isFeatured: true,
        },
      ]),
    });
  });

  await page.context().route('**/api/orders/guest/quote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ subtotal: 19.99, discount: 0, total: 19.99 }),
    });
  });

  await page.goto('/checkout');

  const openBtn = page.getByRole('button', { name: 'Vista rapida' });
  await openBtn.click();

  const closeBtn = page.getByRole('button', { name: 'Cerrar' });
  await expect(closeBtn).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Vaciar' })).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(closeBtn).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer')).not.toHaveClass(/drawer--open/);
  await expect(openBtn).toBeFocused();
});

test('checkout persists guest info + applied coupon across reload (mocked API)', async ({
  page,
}) => {
  await page.context().route('**/api/analytics/events/batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      'gt_guest_cart_v1',
      JSON.stringify([{ productId: 'p1', quantity: 1 }]),
    );
  });

  await page.context().route('**/api/products/lookup', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'p1',
          title: 'Dune',
          description: 'Sci-fi',
          author: 'Frank Herbert',
          price: 20,
          stock: 10,
          type: 'BOOK',
          isFeatured: true,
        },
      ]),
    });
  });

  let couponAppliedCount = 0;
  await page.context().route('**/api/orders/guest/quote', async (route) => {
    const body = route.request().postDataJSON() as unknown as {
      couponCode?: string;
      items?: Array<{ productId: string; quantity: number }>;
    };

    if (body.couponCode === 'GEEK10') {
      couponAppliedCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ subtotal: 20, discount: 5, total: 15, couponCode: 'GEEK10' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ subtotal: 20, discount: 0, total: 20 }),
    });
  });

  await page.goto('/checkout');

  await page.getByLabel('Email', { exact: true }).fill('guest@x.com');
  await page.getByLabel('Repetir email', { exact: true }).fill('guest@x.com');
  await page.getByLabel('Nombre').fill('Guest');
  await page.getByLabel('Apellido').fill('X');
  await page.getByLabel('Cupon').fill('GEEK10');
  await page.getByRole('button', { name: 'Aplicar' }).click();

  await expect(page.getByText('Descuento')).toBeVisible();
  await expect(page.getByText(/-5\s+USD/)).toBeVisible();

  // Give the debounce persistence time to flush.
  await page.waitForTimeout(500);
  await page.reload();

  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('guest@x.com');
  await expect(page.getByLabel('Repetir email', { exact: true })).toHaveValue('guest@x.com');
  await expect(page.getByLabel('Nombre')).toHaveValue('Guest');
  await expect(page.getByLabel('Apellido')).toHaveValue('X');
  await expect(page.getByLabel('Cupon')).toHaveValue('GEEK10');

  // After reload the applied coupon should be re-used automatically via quote.
  await expect(page.getByText('Descuento')).toBeVisible();
  await expect(page.getByText(/-5\s+USD/)).toBeVisible();
  expect(couponAppliedCount).toBeGreaterThanOrEqual(2);
});
