import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard.js';
import { PrismaService } from '../../database/prisma.service.js';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let mockPrisma: Partial<PrismaService>;

  beforeEach(() => {
    mockPrisma = {
      shop: {
        findUnique: vi.fn(),
      } as unknown as typeof mockPrisma.shop,
    };
    guard = new TenantGuard(mockPrisma as PrismaService);
  });

  const createMockContext = (requestData: Record<string, unknown>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => requestData,
      }),
    } as unknown as ExecutionContext;
  };

  it('should throw UnauthorizedException if request has no user or shopId', async () => {
    const context = createMockContext({ user: null });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException if param shopId mismatches user shopId', async () => {
    const context = createMockContext({
      user: { shopId: 'shop-uuid-1' },
      params: { shopId: 'shop-uuid-2' },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if header x-tenant-id mismatches user shopId', async () => {
    const context = createMockContext({
      user: { shopId: 'shop-uuid-1' },
      headers: { 'x-tenant-id': 'shop-uuid-2' },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if shop does not exist or is inactive', async () => {
    const context = createMockContext({
      user: { shopId: 'shop-uuid-1' },
      params: {},
      headers: {},
    });

    (mockPrisma.shop!.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access and attach verified tenant when shop is active and matching', async () => {
    const req: Record<string, unknown> = {
      user: { shopId: 'shop-uuid-1' },
      params: { shopId: 'shop-uuid-1' },
      headers: {},
    };
    const context = createMockContext(req);

    (mockPrisma.shop!.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'shop-uuid-1',
      isActive: true,
      plan: 'PRO',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(req.tenant).toEqual({ id: 'shop-uuid-1', isActive: true, plan: 'PRO' });
  });
});
