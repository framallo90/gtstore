import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncCartDto } from './dto/sync-cart.dto';
import { UpsertCartItemDto } from './dto/upsert-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0,
    );

    return { items, total };
  }

  async upsertItem(userId: string, dto: UpsertCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    if (dto.quantity > product.stock) {
      throw new BadRequestException('Requested quantity exceeds stock');
    }

    return this.prisma.cartItem.upsert({
      where: {
        userId_productId: {
          userId,
          productId: dto.productId,
        },
      },
      update: {
        quantity: dto.quantity,
      },
      create: {
        userId,
        productId: dto.productId,
        quantity: dto.quantity,
      },
      include: { product: true },
    });
  }

  async removeItem(userId: string, productId: string) {
    const existing = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Cart item not found');
    }
    await this.prisma.cartItem.delete({ where: { id: existing.id } });
    return { success: true };
  }

  async clear(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return { success: true };
  }

  async sync(userId: string, dto: SyncCartDto) {
    const requested = dto.items ?? [];
    if (requested.length === 0) {
      return this.getUserCart(userId);
    }

    const addByProductId = new Map<string, number>();
    for (const item of requested) {
      addByProductId.set(
        item.productId,
        (addByProductId.get(item.productId) ?? 0) + item.quantity,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const productIds = Array.from(addByProductId.keys());

      const [products, existingItems] = await Promise.all([
        tx.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, stock: true },
        }),
        tx.cartItem.findMany({
          where: { userId, productId: { in: productIds } },
          select: { productId: true, quantity: true },
        }),
      ]);

      const productById = new Map(products.map((p) => [p.id, p]));
      const existingByProductId = new Map(
        existingItems.map((i) => [i.productId, i]),
      );

      for (const [productId, addQty] of addByProductId.entries()) {
        const product = productById.get(productId);
        if (!product || product.stock <= 0) {
          continue;
        }

        const existingQty = existingByProductId.get(productId)?.quantity ?? 0;
        const nextQty = Math.min(existingQty + addQty, product.stock);
        if (nextQty <= 0) {
          continue;
        }

        await tx.cartItem.upsert({
          where: { userId_productId: { userId, productId } },
          update: { quantity: nextQty },
          create: { userId, productId, quantity: nextQty },
        });
      }

      const items = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      });

      const total = items.reduce(
        (sum, item) => sum + Number(item.product.price) * item.quantity,
        0,
      );

      return { items, total };
    });
  }
}
