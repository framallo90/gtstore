import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      user?: JwtPayload;
    }>();

    let user = request.user;
    if (!user) {
      const token = this.extractBearerToken(request.headers?.authorization);
      if (!token) {
        throw new UnauthorizedException('Missing authenticated user');
      }

      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      if (!secret) {
        throw new UnauthorizedException('Missing JWT access secret');
      }

      try {
        user = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });
        request.user = user;
      } catch {
        throw new UnauthorizedException('Invalid access token');
      }
    }

    return roles.includes(user.role);
  }

  private extractBearerToken(authHeader: string | string[] | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (!value || typeof value !== 'string') {
      return null;
    }

    const match = value.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1]) {
      return null;
    }

    return match[1].trim() || null;
  }
}
