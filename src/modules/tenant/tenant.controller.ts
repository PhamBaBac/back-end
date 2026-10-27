import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { TenantService } from './tenant.service.js';
import { UpdateShopDto } from './dto/update-shop.dto.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../../common/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('shop')
  async getShopProfile(@CurrentTenant() tenant: TenantContext) {
    return this.tenantService.getShopProfile(tenant.shopId);
  }

  @Patch('shop')
  @Roles(Role.OWNER, Role.ADMIN)
  async updateShopProfile(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateShopDto,
  ) {
    return this.tenantService.updateShopProfile(tenant.shopId, dto);
  }

  @Get('staff')
  @Roles(Role.OWNER, Role.ADMIN)
  async getStaffMembers(@CurrentTenant() tenant: TenantContext) {
    return this.tenantService.getStaffMembers(tenant.shopId);
  }

  @Post('staff')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  async createStaff(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateStaffDto,
  ) {
    return this.tenantService.createStaff(tenant.shopId, dto);
  }

  @Patch('staff/:id')
  @Roles(Role.OWNER)
  async updateStaff(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.tenantService.updateStaff(tenant.shopId, staffId, user.userId, dto);
  }

  @Delete('staff/:id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  async deleteStaff(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) staffId: string,
  ) {
    return this.tenantService.deleteStaff(tenant.shopId, staffId, user.userId);
  }
}
