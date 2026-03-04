import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SellerVerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApplySellerDto } from './dto/apply-seller.dto';

@Injectable()
export class SellerVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentApplication(userId: string) {
    return this.prisma.sellerVerificationRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async apply(userId: string, dto: ApplySellerDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, sellerStatus: true },
    });

    if (!user || !user.isActive) {
      throw new ForbiddenException('User is not allowed to apply as seller');
    }
    if (user.sellerStatus === 'APPROVED') {
      throw new ConflictException('User is already approved as seller');
    }
    if (user.sellerStatus === 'SUSPENDED') {
      throw new ForbiddenException('Seller account is suspended');
    }

    const pending = await this.prisma.sellerVerificationRequest.findFirst({
      where: { userId, status: SellerVerificationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      throw new ConflictException('There is already a pending seller verification request');
    }

    const { country, province, city, postalCode, dniFrontPath, dniBackPath, selfiePath } = dto;

    const [, created] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          sellerStatus: 'PENDING_REVIEW',
          country,
          province,
          city,
          postalCode,
        },
      }),
      this.prisma.sellerVerificationRequest.create({
        data: {
          userId,
          status: SellerVerificationStatus.PENDING,
          dniFrontPath,
          dniBackPath,
          selfiePath,
        },
      }),
    ]);

    return created;
  }

  async reapply(userId: string, dto: ApplySellerDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, sellerStatus: true },
    });

    if (!user || !user.isActive) {
      throw new ForbiddenException('User is not allowed to reapply as seller');
    }
    if (user.sellerStatus === 'APPROVED') {
      throw new ConflictException('User is already approved as seller');
    }
    if (user.sellerStatus === 'SUSPENDED') {
      throw new ForbiddenException('Seller account is suspended');
    }

    const latest = await this.prisma.sellerVerificationRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      throw new NotFoundException('Seller verification request not found');
    }
    if (latest.status === SellerVerificationStatus.PENDING) {
      throw new ConflictException('There is already a pending seller verification request');
    }
    if (latest.status === SellerVerificationStatus.APPROVED) {
      throw new ConflictException('Seller verification is already approved');
    }

    const { country, province, city, postalCode, dniFrontPath, dniBackPath, selfiePath } = dto;

    const [, created] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          sellerStatus: 'PENDING_REVIEW',
          country,
          province,
          city,
          postalCode,
        },
      }),
      this.prisma.sellerVerificationRequest.create({
        data: {
          userId,
          status: SellerVerificationStatus.PENDING,
          dniFrontPath,
          dniBackPath,
          selfiePath,
        },
      }),
    ]);

    return created;
  }
}