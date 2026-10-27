import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service.js';
import { AUTH_CONSTANTS } from '../../common/constants/auth.constants.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { AuthResponseData, AuthTokens, JwtPayload } from './interfaces/jwt-payload.interface.js';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET', 'fallback_secret');
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN);
  }

  async register(dto: RegisterDto): Promise<AuthResponseData> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedCode = dto.shopCode.toLowerCase().trim();

    // Check email uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // Check shop code uniqueness
    const existingShop = await this.prisma.shop.findUnique({
      where: { code: normalizedCode },
    });
    if (existingShop) {
      throw new ConflictException('Shop code is already taken. Please choose another code.');
    }

    const passwordHash = await bcrypt.hash(dto.password, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          name: dto.shopName.trim(),
          code: normalizedCode,
        },
      });

      const user = await tx.user.create({
        data: {
          shopId: shop.id,
          email: normalizedEmail,
          passwordHash,
          fullName: dto.fullName.trim(),
          role: Role.OWNER,
        },
      });

      const tokens = await this.generateTokens(user.id, user.email, shop.id, user.role);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          shopId: shop.id,
        },
        shop: {
          id: shop.id,
          name: shop.name,
          code: shop.code,
          plan: shop.plan,
        },
        tokens,
      };
    });
  }

  async login(dto: LoginDto): Promise<AuthResponseData> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        shop: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your user account has been deactivated');
    }

    if (!user.shop || !user.shop.isActive) {
      throw new UnauthorizedException('Your shop is inactive or suspended');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.shopId, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        shopId: user.shopId,
      },
      shop: {
        id: user.shop.id,
        name: user.shop.name,
        code: user.shop.code,
        plan: user.shop.plan,
      },
      tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<{ tokens: AuthTokens }> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.jwtSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token type');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { shop: true },
      });

      if (!user || !user.isActive || !user.shop || !user.shop.isActive) {
        throw new UnauthorizedException('Account or shop is invalid or inactive');
      }

      const tokens = await this.generateTokens(user.id, user.email, user.shopId, user.role);
      return { tokens };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        shopId: true,
        isActive: true,
        createdAt: true,
        shop: {
          select: {
            id: true,
            name: true,
            code: true,
            plan: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async generateTokens(
    userId: string,
    email: string,
    shopId: string,
    role: Role,
  ): Promise<AuthTokens> {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      shopId,
      role,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      shopId,
      role,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload as unknown as Record<string, unknown>, {
        secret: this.jwtSecret,
        expiresIn: this.jwtExpiresIn as `${number}d` | `${number}h` | `${number}m` | `${number}s`,
      }),
      this.jwtService.signAsync(refreshPayload as unknown as Record<string, unknown>, {
        secret: this.jwtSecret,
        expiresIn: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiresIn,
    };
  }
}
