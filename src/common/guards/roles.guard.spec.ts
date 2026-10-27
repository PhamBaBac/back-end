import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user: unknown): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no roles are defined', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const context = createMockContext({ role: Role.STAFF });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user is missing a role', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow OWNER to access route requiring ADMIN', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({ role: Role.OWNER });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject STAFF from accessing route requiring OWNER', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.OWNER]);
    const context = createMockContext({ role: Role.STAFF });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
