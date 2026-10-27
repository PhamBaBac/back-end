import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service.js';
import { AUTH_CONSTANTS } from '../../common/constants/auth.constants.js';
import { UpdateShopDto } from './dto/update-shop.dto.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async getShopProfile(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        _count: {
          select: {
            products: true,
            integrations: true,
            users: true,
            orders: true,
            conversations: true,
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException('Shop tenant not found');
    }

    return shop;
  }

  async updateShopProfile(shopId: string, dto: UpdateShopDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException('Shop tenant not found');
    }

    return this.prisma.shop.update({
      where: { id: shopId },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
      },
    });
  }

  async getStaffMembers(shopId: string) {
    return this.prisma.user.findMany({
      where: { shopId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createStaff(shopId: string, dto: CreateStaffDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email address is already in use by another user');
    }

    const passwordHash = await bcrypt.hash(dto.password, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);

    const newStaff = await this.prisma.user.create({
      data: {
        shopId,
        email: normalizedEmail,
        passwordHash,
        fullName: dto.fullName.trim(),
        role: dto.role,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return newStaff;
  }

  async updateStaff(
    shopId: string,
    staffId: string,
    currentUserId: string,
    dto: UpdateStaffDto,
  ) {
    // Find staff strictly within the shop boundary
    const staff = await this.prisma.user.findFirst({
      where: { id: staffId, shopId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this shop');
    }

    if (staff.role === Role.OWNER && dto.role && dto.role !== Role.OWNER) {
      throw new BadRequestException('Cannot change the role of the shop owner');
    }

    if (staff.id === currentUserId && dto.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    return this.prisma.user.update({
      where: { id: staffId },
      data: {
        fullName: dto.fullName ? dto.fullName.trim() : undefined,
        role: dto.role,
        isActive: dto.isActive,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async deleteStaff(shopId: string, staffId: string, currentUserId: string) {
    const staff = await this.prisma.user.findFirst({
      where: { id: staffId, shopId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this shop');
    }

    if (staff.role === Role.OWNER) {
      throw new BadRequestException('Cannot delete the shop owner account');
    }

    if (staff.id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.prisma.user.delete({
      where: { id: staffId },
    });

    return { message: 'Staff member removed successfully' };
  }
}
