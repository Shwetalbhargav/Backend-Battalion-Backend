import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toIntId(value: any, field: string): number {
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isInteger(n) || n <= 0) throw new BadRequestException(`${field} must be a positive integer`);
    return n;
  }

  create(dto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role as any, // keep compatible if dto.role is string enum
        provider: dto.provider ?? null,
        providerId: dto.providerId ?? null,
      },
    });
  }

  findAll() {
    return this.prisma.user.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: string) {
    const userId = this.toIntId(id, 'id');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const userId = this.toIntId(id, 'id');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email ?? undefined,
        name: dto.name ?? undefined,
        role: (dto.role as any) ?? undefined,
        provider: dto.provider ?? undefined,
        providerId: dto.providerId ?? undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const userId = this.toIntId(id, 'id');
    return this.prisma.user.delete({ where: { id: userId } });
  }

  // ------- helpers often used by Google OAuth flow -------

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByProvider(provider: string, providerId: string) {
    return this.prisma.user.findUnique({
      where: { provider_providerId: { provider, providerId } } as any,
    });
  }

  linkGoogle(userId: number, providerId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { provider: 'google', providerId },
    });
  }
}
