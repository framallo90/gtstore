import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
    deactivatedAt: true,
    lastLoginAt: true,
    lastSeenAt: true,
    emailVerifiedAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  list() {
    return this.prisma.user.findMany({
      select: this.userSelect,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateRole(actorUserId: string, userId: string, dto: UpdateUserRoleDto) {
    return this.updateUser(actorUserId, userId, { role: dto.role });
  }

  async updateUser(actorUserId: string, userId: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    if (!existing.isActive) {
      throw new BadRequestException('La cuenta esta desactivada y solo se muestra en historial');
    }

    const data: Partial<{
      email: string;
      firstName: string;
      lastName: string;
      role: Role;
      passwordHash: string;
    }> = {};

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new BadRequestException('Email cannot be empty');
      }

      if (normalizedEmail !== existing.email) {
        const emailOwner = await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });

        if (emailOwner && emailOwner.id !== existing.id) {
          throw new ConflictException('Email already exists');
        }
      }

      data.email = normalizedEmail;
    }

    if (dto.firstName !== undefined) {
      const firstName = dto.firstName.trim();
      if (!firstName) {
        throw new BadRequestException('First name cannot be empty');
      }
      data.firstName = firstName;
    }

    if (dto.lastName !== undefined) {
      const lastName = dto.lastName.trim();
      if (!lastName) {
        throw new BadRequestException('Last name cannot be empty');
      }
      data.lastName = lastName;
    }

    if (dto.role !== undefined) {
      await this.assertValidAdminTransition(actorUserId, existing.id, existing.role, dto.role);
      data.role = dto.role;
    }

    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (Object.keys(data).length === 0) {
      return this.prisma.user.findUnique({
        where: { id: userId },
        select: this.userSelect,
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: this.userSelect,
    });
  }

  async deleteUser(actorUserId: string, userId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true, isActive: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (existing.id === actorUserId) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta');
    }

    if (existing.role === Role.ADMIN && existing.isActive) {
      const admins = await this.prisma.user.count({
        where: { role: Role.ADMIN, isActive: true },
      });
      if (admins <= 1) {
        throw new BadRequestException('Debe existir al menos un usuario ADMIN');
      }
    }

    if (!existing.isActive) {
      return this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: this.userSelect,
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        refreshTokenHash: null,
      },
      select: this.userSelect,
    });
  }

  async reactivateUser(userId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (existing.isActive) {
      return this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: this.userSelect,
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        deactivatedAt: null,
      },
      select: this.userSelect,
    });
  }

  private async assertValidAdminTransition(
    actorUserId: string,
    targetUserId: string,
    currentRole: Role,
    nextRole: Role,
  ) {
    if (currentRole !== Role.ADMIN || nextRole === Role.ADMIN) {
      return;
    }

    if (actorUserId === targetUserId) {
      throw new BadRequestException('No puedes quitarte permisos ADMIN a ti mismo');
    }

    const admins = await this.prisma.user.count({
      where: { role: Role.ADMIN, isActive: true },
    });
    if (admins <= 1) {
      throw new BadRequestException('Debe existir al menos un usuario ADMIN');
    }
  }
}
