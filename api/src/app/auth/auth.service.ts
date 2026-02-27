import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import type { JwtPayload } from '../common/types/jwt-payload.type';

type LoginInput = {
  email: string;
  password: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    const exists = await this.prisma.user.findUnique({
      where: { email },
    });
    if (exists) {
      throw new BadRequestException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenHash = this.hashToken(verificationToken);
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        lastLoginAt: new Date(),
        lastSeenAt: new Date(),
        emailVerificationTokenHash: verificationTokenHash,
        emailVerificationTokenExpiresAt: verificationExpiresAt,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.setRefreshTokenHash(user.id, tokens.refreshToken, {
      touchLoginAt: true,
      touchSeenAt: true,
    });

    // Use URL fragment to avoid leaking tokens via server logs, referrers and analytics query capture.
    const verifyUrl = `${this.getStoreBaseUrl()}/verify-email#token=${verificationToken}`;
    this.email
      .sendEmailVerification({ to: user.email, customerName: user.firstName, verifyUrl })
      .catch(() => undefined);

    return {
      user: this.serializeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginInput, allowedRoles?: Role[]) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.setRefreshTokenHash(user.id, tokens.refreshToken, {
      touchLoginAt: true,
      touchSeenAt: true,
    });
    return {
      user: this.serializeUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refreshTokenHash || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.setRefreshTokenHash(user.id, tokens.refreshToken, {
      touchSeenAt: true,
    });
    return {
      user: this.serializeUser(user),
      ...tokens,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
    return this.serializeUser(user);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { success: true };
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashToken(token);
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return { success: true };
  }

  async requestPasswordReset(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    if (!email) {
      return { success: true };
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Avoid email enumeration.
      return { success: true };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetTokenExpiresAt: expiresAt,
      },
    });

    // Use URL fragment to avoid leaking tokens via server logs, referrers and analytics query capture.
    const resetUrl = `${this.getStoreBaseUrl()}/reset-password#token=${token}`;
    this.email
      .sendPasswordReset({ to: user.email, customerName: user.firstName, resetUrl })
      .catch(() => undefined);

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        refreshTokenHash: null,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    return { success: true };
  }

  private serializeUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  private async generateTokens(userId: string, email: string, role: Role) {
    const payload: JwtPayload = { sub: userId, email, role };
    const accessTtl = this.configService.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const refreshTtl =
      this.configService.get<string>('JWT_REFRESH_TTL') ?? '7d';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.getAccessSecret(),
      expiresIn: accessTtl as JwtSignOptions['expiresIn'],
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: refreshTtl as JwtSignOptions['expiresIn'],
    });

    return { accessToken, refreshToken };
  }

  private getAccessSecret() {
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is required');
    }
    return secret;
  }

  private getRefreshSecret() {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is required');
    }
    return secret;
  }

  private async setRefreshTokenHash(
    userId: string,
    refreshToken: string,
    options?: { touchLoginAt?: boolean; touchSeenAt?: boolean },
  ) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const now = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash,
        ...(options?.touchLoginAt ? { lastLoginAt: now } : {}),
        ...(options?.touchSeenAt ? { lastSeenAt: now } : {}),
      },
    });
  }

  private getStoreBaseUrl() {
    const raw = (this.configService.get<string>('STORE_BASE_URL') ?? 'http://localhost:4200')
      .trim()
      .replace(/\/+$/, '');
    return raw || 'http://localhost:4200';
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
