import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase(),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code?.toUpperCase(),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }
    await this.prisma.coupon.delete({ where: { id } });
    return { success: true };
  }

  async validateCode(code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!coupon || !coupon.isActive) {
      return { valid: false, reason: 'Coupon not found or inactive' };
    }

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      return { valid: false, reason: 'Coupon is not active yet' };
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      return { valid: false, reason: 'Coupon has expired' };
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, reason: 'Coupon usage limit reached' };
    }

    return { valid: true, coupon };
  }
}