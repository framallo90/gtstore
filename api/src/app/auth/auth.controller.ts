import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private parseDurationMs(value: string): number | undefined {
    // Supports simple durations like: 15m, 7d, 1h, 30s.
    const match = value.trim().match(/^(\d+)\s*([smhd])$/i);
    if (!match) {
      return undefined;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    const multiplier = multipliers[unit];
    if (!multiplier) {
      return undefined;
    }

    return amount * multiplier;
  }

  private getRefreshCookieOptions() {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const ttl = this.configService.get<string>('JWT_REFRESH_TTL') ?? '7d';
    const maxAge = this.parseDurationMs(ttl);

    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProd,
      path: '/api/auth',
      ...(maxAge ? { maxAge } : {}),
    };
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, this.getRefreshCookieOptions());
  }

  private clearRefreshTokenCookie(res: Response) {
    const opts = this.getRefreshCookieOptions();
    res.clearCookie('refreshToken', {
      path: opts.path,
      httpOnly: opts.httpOnly,
      sameSite: opts.sameSite,
      secure: opts.secure,
    });
  }

  @Post('register')
  @ApiOperation({ summary: 'Register customer account' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Post('login')
  @ApiOperation({ summary: 'Login and receive tokens' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Post('admin/login')
  @ApiOperation({ summary: 'Admin/staff login and receive tokens' })
  async adminLogin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.login(dto, [
      Role.ADMIN,
      Role.STAFF,
    ]);
    this.setRefreshTokenCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.refresh(
      dto.refreshToken ?? req.cookies?.refreshToken,
    );
    this.setRefreshTokenCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email using a token sent via email' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('password/forgot')
  @ApiOperation({ summary: 'Request password reset email (always returns success)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password/reset')
  @ApiOperation({ summary: 'Reset password using a token sent via email' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) res: Response) {
    this.clearRefreshTokenCookie(res);
    return this.authService.logout(user.sub);
  }
}
