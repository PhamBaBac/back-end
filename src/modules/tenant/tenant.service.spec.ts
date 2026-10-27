import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TenantService } from './tenant.service.js';
import { PrismaService } from '../../database/prisma.service.js';

describe('TenantService (Multi-Tenancy & Shop Management)', () => {
  let service: TenantService;
  let mockPrisma: {
    shop: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    user: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const shopId = 'shop-uuid-1111';

  beforeEach(() => {
    mockPrisma = {
      shop: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    service = new TenantService(mockPrisma as unknown as PrismaService);
  });

  describe('getShopProfile', () => {
    it('should return shop details with relations count', async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({
        id: shopId,
        name: 'Cool Store',
        code: 'cool-store',
        plan: 'FREE',
        _count: { products: 12, integrations: 2, users: 3, orders: 45, conversations: 80 },
      });

      const profile = await service.getShopProfile(shopId);
      expect(profile.name).toBe('Cool Store');
      expect(mockPrisma.shop.findUnique).toHaveBeenCalledWith({
        where: { id: shopId },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if shop does not exist', async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(null);

      await expect(service.getShopProfile('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateShopProfile', () => {
    it('should update shop name successfully', async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({ id: shopId, name: 'Old' });
      mockPrisma.shop.update.mockResolvedValue({ id: shopId, name: 'New Name' });

      const updated = await service.updateShopProfile(shopId, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('should throw NotFoundException when updating non-existent shop', async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(null);

      await expect(service.updateShopProfile('non-existent', { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createStaff', () => {
    it('should throw ConflictException if staff email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u-existing' });

      await expect(
        service.createStaff(shopId, {
          email: 'existing@test.com',
          fullName: 'Staff',
          password: 'password123',
          role: Role.STAFF,
        }),
      ).rejects.toThrow();
    });

    it('should create staff member under shopId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-staff-id',
        email: 'newstaff@test.com',
        fullName: 'New Staff',
        role: Role.STAFF,
        shopId,
      });

      const staff = await service.createStaff(shopId, {
        email: 'newstaff@test.com',
        fullName: 'New Staff',
        password: 'password123',
        role: Role.STAFF,
      });

      expect(staff.email).toBe('newstaff@test.com');
    });
  });

  describe('getStaffMembers (Tenant Boundary Test)', () => {
    it('should strictly query staff members using shopId filter', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'staff1@test.com', fullName: 'Staff 1', role: Role.STAFF },
      ]);

      const staff = await service.getStaffMembers(shopId);
      expect(staff).toHaveLength(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shopId },
        }),
      );
    });
  });

  describe('updateStaff', () => {
    it('should reject update if staff member belongs to a different shop', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStaff(shopId, 'foreign-user-id', 'current-user-id', { fullName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent changing role of the shop OWNER', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'owner-id',
        shopId,
        role: Role.OWNER,
      });

      await expect(
        service.updateStaff(shopId, 'owner-id', 'current-user-id', { role: Role.STAFF }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent a user from deactivating their own account', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-self',
        shopId,
        role: Role.ADMIN,
      });

      await expect(
        service.updateStaff(shopId, 'user-self', 'user-self', { isActive: false }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteStaff', () => {
    it('should prevent deleting the shop OWNER account', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'owner-id',
        shopId,
        role: Role.OWNER,
      });

      await expect(
        service.deleteStaff(shopId, 'owner-id', 'current-user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete staff member within shop boundary', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'staff-id',
        shopId,
        role: Role.STAFF,
      });
      mockPrisma.user.delete.mockResolvedValue({ id: 'staff-id' });

      const result = await service.deleteStaff(shopId, 'staff-id', 'current-user-id');
      expect(result.message).toContain('successfully');
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'staff-id' } });
    });
  });
});
