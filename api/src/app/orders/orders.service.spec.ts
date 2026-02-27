import { BadRequestException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { createHash } from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  it('throws when cart is empty', async () => {
    const prisma = {
      $transaction: async (
        cb: (tx: {
          $queryRaw: (...args: unknown[]) => Promise<unknown>;
          cartItem: { findMany: () => Promise<unknown[]> };
        }) => Promise<unknown>,
      ) =>
        cb({
          $queryRaw: async () => [],
          cartItem: {
            findMany: async () => [],
          },
        }),
    };

    const email = { sendOrderConfirmation: jest.fn(), sendOrderStatusUpdate: jest.fn() };
    const service = new OrdersService(prisma as unknown as PrismaService, email as any);

    await expect(service.createFromCart('user-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('enforces stock atomically via updateMany', async () => {
    const tx = {
      $queryRaw: async () => [],
      cartItem: {
        findMany: async () => [
          {
            productId: 'p1',
            quantity: 2,
            product: {
              title: 'Dune',
              isActive: true,
              stock: 2,
              price: 10,
            },
          },
        ],
        deleteMany: async () => ({ count: 1 }),
      },
      product: {
        updateMany: async () => ({ count: 0 }),
      },
      coupon: {
        findUnique: async () => null,
      },
      order: {
        create: jest.fn(),
      },
    };

    const prisma = {
      $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    };

    const email = { sendOrderConfirmation: jest.fn(), sendOrderStatusUpdate: jest.fn() };
    const service = new OrdersService(prisma as unknown as PrismaService, email as any);

    await expect(
      service.createFromCart('user-1', { notes: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('enforces coupon usageLimit atomically via updateMany', async () => {
    const coupon = {
      code: 'SAVE10',
      isActive: true,
      startsAt: null,
      expiresAt: null,
      usageLimit: 1,
      usedCount: 1,
      type: DiscountType.FIXED,
      discount: 10,
    };

    const tx = {
      $queryRaw: async () => [],
      cartItem: {
        findMany: async () => [
          {
            productId: 'p1',
            quantity: 1,
            product: {
              title: 'Dune',
              isActive: true,
              stock: 10,
              price: 10,
            },
          },
        ],
        deleteMany: async () => ({ count: 1 }),
      },
      product: {
        updateMany: async () => ({ count: 1 }),
      },
      coupon: {
        findUnique: async () => coupon,
        updateMany: async () => ({ count: 0 }),
        update: jest.fn(),
      },
      order: {
        create: jest.fn(),
      },
    };

    const prisma = {
      $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    };

    const email = { sendOrderConfirmation: jest.fn(), sendOrderStatusUpdate: jest.fn() };
    const service = new OrdersService(prisma as unknown as PrismaService, email as any);

    await expect(
      service.createFromCart('user-1', { couponCode: 'save10' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('sends confirmation email for guest orders (best-effort)', async () => {
    const email = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
      sendOrderStatusUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const prisma = {
      $transaction: async (_cb: unknown) => ({
        id: 'o1',
        guestEmail: 'guest@x.com',
        guestFirstName: 'Guest',
        guestLastName: 'X',
        total: 19.99,
        items: [{ productName: 'Dune', quantity: 1, unitPrice: 19.99 }],
      }),
    };

    const service = new OrdersService(prisma as unknown as PrismaService, email as any);

    await service.createGuestOrder({
      items: [{ productId: 'p1', quantity: 1 }],
      guestEmail: 'guest@x.com',
      guestFirstName: 'Guest',
      guestLastName: 'X',
    } as any);

    expect(email.sendOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@x.com',
        order: expect.objectContaining({ id: 'o1' }),
      }),
    );
  });

  it('returns existing guest order for an idempotency key (no duplicate email)', async () => {
    const idempotencyKey = 'idem-guest-1';
    const dto = {
      items: [{ productId: 'p1', quantity: 1 }],
      couponCode: 'GEEK10',
      paymentMethod: 'TRANSFER',
      notes: 'x',
      guestEmail: 'Guest@X.com',
      guestFirstName: ' Guest ',
      guestLastName: ' X ',
    } as any;

    const expectedHash = createHash('sha256')
      .update(
        JSON.stringify({
          guestEmail: 'guest@x.com',
          guestFirstName: 'Guest',
          guestLastName: 'X',
          couponCode: 'GEEK10',
          paymentMethod: 'TRANSFER',
          notes: 'x',
          shippingCity: '',
          shippingPostalCode: '',
          items: [{ productId: 'p1', quantity: 1 }],
        }),
      )
      .digest('hex');

    const prisma = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue({
          requestHash: expectedHash,
          orderId: 'o-idem',
        }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'o-idem',
          guestEmail: 'guest@x.com',
          guestFirstName: 'Guest',
          guestLastName: 'X',
          total: 10,
          items: [],
        }),
      },
      $transaction: jest.fn(),
    };

    const email = { sendOrderConfirmation: jest.fn(), sendOrderStatusUpdate: jest.fn() };
    const service = new OrdersService(prisma as unknown as PrismaService, email as any);

    const order = await service.createGuestOrder(dto, { idempotencyKey });

    expect(order).toHaveProperty('id', 'o-idem');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(email.sendOrderConfirmation).not.toHaveBeenCalled();
  });

  it('sends confirmation email for user checkout (best-effort)', async () => {
    const email = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
      sendOrderStatusUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const prisma = {
      $transaction: async (_cb: unknown) => ({
        id: 'o2',
        total: 10,
        items: [{ productName: 'Dune', quantity: 1, unitPrice: 10 }],
      }),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'user@x.com',
          firstName: 'U',
          lastName: 'X',
        }),
      },
    };

    const service = new OrdersService(prisma as unknown as PrismaService, email as any);
    await service.createFromCart('user-1', {});

    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
    expect(email.sendOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@x.com',
        order: expect.objectContaining({ id: 'o2' }),
      }),
    );
  });

  it('sends status update email when order status changes (best-effort)', async () => {
    const email = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
      sendOrderStatusUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const prisma = {
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'o3' })
          .mockResolvedValueOnce({
            id: 'o3',
            user: null,
            guestEmail: 'guest@x.com',
            guestFirstName: 'Guest',
            guestLastName: 'X',
          }),
        update: jest.fn().mockResolvedValue({ id: 'o3' }),
      },
    };

    const service = new OrdersService(prisma as unknown as PrismaService, email as any);
    await service.updateStatus('o3', { status: 'SHIPPED' } as any);

    await new Promise((resolve) => setImmediate(resolve));

    expect(email.sendOrderStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@x.com',
        orderId: 'o3',
        status: 'SHIPPED',
      }),
    );
  });
});
