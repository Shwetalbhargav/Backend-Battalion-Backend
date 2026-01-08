// src/users/users.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * UsersService
 * - CRUD for users
 * - Helpers used by OAuth flows (Google)
 *
 * Notes:
 * - We accept `id` as `number | string` in some methods because controllers often
 *   pass params as strings.
 * - Provider is standardized to lowercase: 'google'
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Convert an incoming id (string/number) into a positive integer.
   * Throws a 400 if invalid.
   */
  private toIntId(value: number | string, field: string): number {
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return n;
  }

  /**
   * Safe read of an arbitrary DTO property without resorting to `any`.
   */
  private getProp(obj: unknown, key: string): unknown {
    if (obj && typeof obj === 'object' && key in obj) {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }

  private optionalString(obj: unknown, key: string): string | undefined {
    const v = this.getProp(obj, key);
    return typeof v === 'string' ? v : undefined;
  }

  private optionalNullableString(
    obj: unknown,
    key: string,
  ): string | null | undefined {
    const v = this.getProp(obj, key);
    if (v === null) return null;
    return typeof v === 'string' ? v : undefined;
  }

  private optionalRole(obj: unknown, key: string): Role | undefined {
    const v = this.getProp(obj, key);
    if (
      typeof v === 'string' &&
      (Object.values(Role) as string[]).includes(v)
    ) {
      return v as Role;
    }
    return undefined;
  }

  // ----------------------------
  // CREATE
  // ----------------------------

  /**
   * Create a new user.
   * If role/provider fields are optional in your DTO, we default safely.
   */
  async create(dto: CreateUserDto): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: dto.email,
        // Prisma schema often uses `string | null` for name; keep it safe:
        name: this.optionalNullableString(dto, 'name') ?? null,

        // Default role if not provided
        role: this.optionalRole(dto, 'role') ?? Role.PATIENT,

        // Optional OAuth linking fields
        provider: this.optionalNullableString(dto, 'provider') ?? null,
        providerId: this.optionalNullableString(dto, 'providerId') ?? null,
      },
    });
  }

  // ----------------------------
  // READ
  // ----------------------------

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number | string): Promise<User> {
    const userId = this.toIntId(id, 'id');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Find by provider+providerId.
   *
   * If your Prisma schema has a composite unique like:
   * @@unique([provider, providerId])
   * OR a named constraint:
   * @@unique([provider, providerId], name: "provider_providerId")
   *
   * then this will work via `findFirst` regardless.
   */
  async findByProvider(
    provider: string,
    providerId: string,
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { provider, providerId },
    });
  }

  // ----------------------------
  // UPDATE
  // ----------------------------

  async update(id: number | string, dto: UpdateUserDto): Promise<User> {
    const userId = this.toIntId(id, 'id');
    await this.findOne(userId); // ensures 404 if missing

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email: this.optionalString(dto, 'email') ?? undefined,
        name: this.optionalNullableString(dto, 'name') ?? undefined,

        // Role may come as string; keep permissive
        role: this.optionalRole(dto, 'role') ?? undefined,

        // OAuth linking fields if your update DTO supports them
        provider: this.optionalNullableString(dto, 'provider') ?? undefined,
        providerId: this.optionalNullableString(dto, 'providerId') ?? undefined,
      },
    });
  }

  async updateRole(userId: number, role: Role): Promise<User> {
    const id = this.toIntId(userId, 'userId');
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  // ----------------------------
  // OAUTH HELPERS (Google)
  // ----------------------------

  /**
   * Used by Google OAuth flow:
   * - If a user exists with provider+providerId, update their info.
   * - Else if a user exists with same email, link Google to that account.
   * - Else create a brand new user.
   */
  async findOrCreateGoogleUser(input: {
    email: string;
    name: string;
    providerId: string;
    role: Role;
  }): Promise<User> {
    const { email, name, providerId, role } = input;

    if (!email || !providerId) {
      throw new BadRequestException('Invalid Google profile data');
    }

    // 1) Look up by provider+providerId
    const byProvider = await this.findByProvider('google', providerId);
    if (byProvider) {
      return this.prisma.user.update({
        where: { id: byProvider.id },
        data: {
          email,
          name: name ?? byProvider.name ?? null,
          role: byProvider.role ?? role,
          provider: 'google',
          providerId,
        },
      });
    }

    // 2) Look up by email (existing local account)
    const byEmail = await this.findByEmail(email);
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          name: name ?? byEmail.name ?? null,
          provider: 'google',
          providerId,
          // Only set role if it was missing; otherwise keep existing role
          role: byEmail.role ?? role,
        },
      });
    }

    // 3) Create a new user
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

  /**
   * Link a google providerId to an existing user.
   */
  async linkGoogle(userId: number, providerId: string): Promise<User> {
    const id = this.toIntId(userId, 'userId');
    await this.findOne(id);

    if (!providerId) throw new BadRequestException('providerId is required');

    return this.prisma.user.update({
      where: { id },
      data: { provider: 'google', providerId },
    });
  }

  // ----------------------------
  // DELETE
  // ----------------------------

  async remove(id: number | string): Promise<User> {
    const userId = this.toIntId(id, 'id');
    await this.findOne(userId);

    return this.prisma.user.delete({ where: { id: userId } });
  }
}
