import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../constants/auth.constants.js';

const ROLE_PRIORITY: Record<Role, number> = {
  [Role.OWNER]: 3,
  [Role.ADMIN]: 2,
  [Role.STAFF]: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('User does not have an assigned role');
    }

    const userPriority = ROLE_PRIORITY[user.role as Role] ?? 0;
    const hasRole = requiredRoles.some((role) => userPriority >= (ROLE_PRIORITY[role] ?? 99));

    if (!hasRole) {
      throw new ForbiddenException(`Insufficient permissions. Required one of: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
