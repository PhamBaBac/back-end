import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface TenantContext {
  userId: string;
  shopId: string;
  role: Role;
}

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return {
      userId: user.userId || user.sub,
      shopId: user.shopId,
      role: user.role,
    };
  },
);
