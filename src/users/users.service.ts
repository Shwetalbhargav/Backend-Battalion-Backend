import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name ?? null,
        role: dto.role,
        provider: dto.provider ?? null,
        providerId: dto.providerId ?? null,
      },
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email ?? undefined,
        name: dto.name ?? undefined,
        role: dto.role ?? undefined,
        provider: dto.provider ?? undefined,
        providerId: dto.providerId ?? undefined,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.user.delete({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByProvider(provider: string, providerId: string) {
    return this.prisma.user.findFirst({ where: { provider, providerId } });
  }

  // ✅ FIX: userId is Int in Prisma => number in TS
  linkGoogle(userId: number, providerId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { provider: 'google', providerId },
    });
  }
}
