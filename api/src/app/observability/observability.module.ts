import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ErrorCacheService } from './error-cache.service';
import { ErrorLogService } from './error-log.service';
import { ErrorsController } from './errors.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ErrorsController],
  providers: [
    ErrorCacheService,
    ErrorLogService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class ObservabilityModule {}
