import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../../database/prisma.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: {
    user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    shop: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let mockJwtService: {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
  };
  let mockConfigService: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      shop: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };

    mockJwtService = {
      signAsync: vi.fn().mockResolvedValue('mock_token'),
      verifyAsync: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn((key: string, def?: string) => {
        if (key === 'JWT_SECRET') return 'test_secret_key_12345678901234567890';
        if (key === 'JWT_EXPIRES_IN') return '1d';
        return def;
      }),
    };

    service = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockJwtService as unknown as JwtService,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('register', () => {
    const registerDto = {
      shopName: 'Test Shop',
      shopCode: 'test-shop',
      email: 'owner@test.com',
      password: 'password123',
      fullName: 'Shop Owner',
    };

    it('should throw ConflictException if email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'owner@test.com' });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if shopCode is already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.shop.findUnique.mockResolvedValue({ id: 's1', code: 'test-shop' });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should register shop and user in transaction and return tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.shop.findUnique.mockResolvedValue(null);

      mockPrisma.shop.create.mockResolvedValue({
        id: 'shop-uuid-1',
        name: 'Test Shop',
        code: 'test-shop',
        plan: 'FREE',
      });

      mockPrisma.user.create.mockResolvedValue({
        id: 'user-uuid-1',
        shopId: 'shop-uuid-1',
        email: 'owner@test.com',
        fullName: 'Shop Owner',
        role: Role.OWNER,
      });

      const result = await service.register(registerDto);

      expect(result.user.email).toBe('owner@test.com');
      expect(result.shop.code).toBe('test-shop');
      expect(result.tokens.accessToken).toBe('mock_token');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const hash = await bcrypt.hash('different_password', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@test.com',
        passwordHash: hash,
        isActive: true,
        shop: { id: 's1', isActive: true },
      });

      await expect(
        service.login({ email: 'user@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return user, shop and tokens on valid login', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@test.com',
        passwordHash: hash,
        fullName: 'Test User',
        role: Role.OWNER,
        shopId: 's1',
        isActive: true,
        shop: { id: 's1', name: 'My Shop', code: 'my-shop', plan: 'FREE', isActive: true },
      });

      const result = await service.login({ email: 'user@test.com', password: 'password123' });

      expect(result.user.email).toBe('user@test.com');
      expect(result.tokens.accessToken).toBe('mock_token');
    });

    it('should throw UnauthorizedException if user account is deactivated', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@test.com',
        passwordHash: hash,
        isActive: false,
        shop: { id: 's1', isActive: true },
      });

      await expect(
        service.login({ email: 'user@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if shop is inactive', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@test.com',
        passwordHash: hash,
        isActive: true,
        shop: { id: 's1', isActive: false },
      });

      await expect(
        service.login({ email: 'user@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(
        service.refreshToken({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token type is not refresh', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'u1',
        type: 'access',
      });

      await expect(
        service.refreshToken({ refreshToken: 'access-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return new tokens on valid refresh token', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'u1',
        type: 'refresh',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@test.com',
        shopId: 's1',
        role: Role.OWNER,
        isActive: true,
        shop: { id: 's1', isActive: true },
      });

      const result = await service.refreshToken({ refreshToken: 'valid-refresh-token' });
      expect(result.tokens.accessToken).toBe('mock_token');
    });
  });

  describe('getMe', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('non-existent')).rejects.toThrow(UnauthorizedException);
    });

    it('should return user profile without passwordHash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@test.com',
        fullName: 'Test User',
        role: Role.OWNER,
        shopId: 's1',
        shop: { id: 's1', name: 'My Shop', code: 'my-shop', plan: 'FREE' },
      });

      const me = await service.getMe('u1');
      expect(me.email).toBe('user@test.com');
      expect(me).not.toHaveProperty('passwordHash');
    });
  });
});

