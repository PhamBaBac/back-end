import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = ctxGetRequest(context);
    const user = request.user;

    if (!user || !user.shopId) {
      throw new UnauthorizedException('Tenant context not found. Authentication required.');
    }

    // Prevent cross-tenant horizontal escalation if shopId is passed in params or headers
    const paramShopId = request.params?.shopId;
    const headerShopId = request.headers?.['x-tenant-id'];

    if (paramShopId && paramShopId !== user.shopId) {
      throw new ForbiddenException('Cross-tenant access forbidden: Shop ID mismatch');
    }

    if (headerShopId && headerShopId !== user.shopId) {
      throw new ForbiddenException('Cross-tenant access forbidden: Tenant header mismatch');
    }

    // Verify tenant shop is active
    const shop = await this.prisma.shop.findUnique({
      where: { id: user.shopId },
      select: { id: true, isActive: true, plan: true },
    });

    if (!shop || !shop.isActive) {
      throw new ForbiddenException('Shop tenant is inactive, suspended, or does not exist');
    }

    // Attach verified shop metadata to request for convenience
    request.tenant = shop;

    return true;
  }
}

function ctxGetRequest(context: ExecutionContext) {
  return context.switchToHttp().getRequest();
}
