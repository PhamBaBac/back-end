import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller.js';
import { TenantService } from './tenant.service.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@Module({
  controllers: [TenantController],
  providers: [TenantService, TenantGuard, RolesGuard],
  exports: [TenantService, TenantGuard, RolesGuard],
})
export class TenantModule {}
