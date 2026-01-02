// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- CREATE ----------
  async create(dto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name ?? null,
        role: dto.role ?? Role.PATIENT,
        // If your schema has these, keep them; otherwise remove:
        provider: dto.provider ?? null,
        providerId: dto.providerId ?? null,
        name: dto.name,
        role: dto.role,
        provider: dto.provider,
        providerId: dto.providerId,
      },
    });
  }

  // ---------- READ ----------
  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByProvider(provider: string, providerId: string) {
    return this.prisma.user.findFirst({ where: { provider, providerId } });
  }

  // ---------- UPDATE ----------
  async update(id: number, dto: UpdateUserDto) {
    // optional existence check
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email ?? undefined,
        name: dto.name ?? undefined,
        role: dto.role ?? undefined,
      },
    });
  }

  async updateRole(userId: number, role: Role) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  // ✅ OAuth helper (used by AuthService)
  // Policy:
  // - If user exists: update provider/providerId and (optionally) role
  // - If user doesn't exist: create with role and provider fields
  async findOrCreateGoogleUser(input: {
    email: string;
    name: string;
    providerId: string;
    role: Role;
  }) {
    const { email, name, providerId, role } = input;

    // 1) Try by provider first (most precise)
    const byProvider = await this.findByProvider('google', providerId);
    if (byProvider) {
      return this.prisma.user.update({
        where: { id: byProvider.id },
        data: {
          email,
          name: name ?? null,
          role, // if you DON'T want role to change on every login, set: role: byProvider.role
        },
      });
    }

    // 2) Try by email (common for first-time link)
    const byEmail = await this.findByEmail(email);
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          name: name ?? byEmail.name ?? null,
          provider: 'google',
          providerId,
          role, // or keep existing: role: byEmail.role
        },
      });
    }

    // 3) Create new user
    return this.prisma.user.create({
      data: {
        email,
        name: name ?? null,
        role,
        provider: 'google',
        providerId,
      },
    });
  }

  // ✅ FIX: userId is Int in Prisma => number in TS
  async linkGoogle(userId: number, providerId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { provider: 'google', providerId },
    });
  }

  // ---------- DELETE ----------
  async remove(id: number) {
    // optional existence check
    await this.findOne(id);

    return this.prisma.user.delete({ where: { id } });
  }
}
