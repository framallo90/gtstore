import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { UsersService } from './users.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles(Role.ADMIN)
  list() {
    return this.usersService.list();
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async updateRole(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const updated = await this.usersService.updateRole(actor.sub, id, dto);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'USER_ROLE_UPDATE',
        entityType: 'User',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: { role: dto.role },
      })
      .catch(() => undefined);
    return updated;
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const updated = await this.usersService.updateUser(actor.sub, id, dto);
    const changedFields = Object.keys(dto).filter((field) => field !== 'password');
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'USER_UPDATE',
        entityType: 'User',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: {
          changedFields,
          passwordUpdated: typeof dto.password === 'string',
        },
      })
      .catch(() => undefined);
    return updated;
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
  ) {
    const deactivated = await this.usersService.deleteUser(actor.sub, id);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'USER_DEACTIVATE',
        entityType: 'User',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: {
          deactivatedRole: deactivated.role,
        },
      })
      .catch(() => undefined);

    return { success: true, deactivatedUser: deactivated };
  }

  @Patch(':id/reactivate')
  @Roles(Role.ADMIN)
  async reactivate(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
  ) {
    const reactivated = await this.usersService.reactivateUser(id);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'USER_REACTIVATE',
        entityType: 'User',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: {
          reactivatedRole: reactivated.role,
        },
      })
      .catch(() => undefined);

    return { success: true, reactivatedUser: reactivated };
  }
}
