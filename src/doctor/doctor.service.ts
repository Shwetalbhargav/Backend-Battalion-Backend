import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDoctorDto) {
    if (dto.userId === undefined || dto.userId === null) {
      throw new BadRequestException('userId is required');
    }

    const existing = await this.prisma.doctor.findUnique({
      where: { userId: dto.userId },
    });
    if (existing) {
      throw new BadRequestException('Doctor profile already exists for this userId');
    }

    return this.prisma.doctor.create({
      data: {
        userId: dto.userId,
        specialization: (dto as any).specialization ?? null,
        experienceYears: (dto as any).experienceYears ?? null,
        bio: (dto as any).bio ?? null,
        isActive: (dto as any).isActive ?? true,
      },
    });
  }

  findAll() {
    return this.prisma.doctor.findMany({
      include: { user: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const doc = await this.prisma.doctor.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!doc) throw new NotFoundException('Doctor not found');
    return doc;
  }

  async update(id: number, dto: UpdateDoctorDto) {
    await this.findOne(id);
    return this.prisma.doctor.update({
      where: { id },
      data: {
        specialization: (dto as any).specialization ?? undefined,
        experienceYears: (dto as any).experienceYears ?? undefined,
        bio: (dto as any).bio ?? undefined,
        isActive: (dto as any).isActive ?? undefined,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.doctor.delete({ where: { id } });
  }

  // ✅ FIX: userId is Int => number
  async ensureDoctorProfile(userId: number) {
    const existing = await this.prisma.doctor.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.doctor.create({
      data: {
        userId,
        specialization: null,
        experienceYears: null,
        bio: null,
        isActive: true,
      },
    });
  }
}
