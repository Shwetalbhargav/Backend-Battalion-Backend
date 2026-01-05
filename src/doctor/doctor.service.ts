import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  private toIntId(value: any, field: string): number {
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isInteger(n) || n <= 0) throw new BadRequestException(`${field} must be a positive integer`);
    return n;
  }

  async ensureDoctorProfile(userIdRaw: number | string) {
    const userId = this.toIntId(userIdRaw, 'userId');

    const existing = await this.prisma.doctor.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.doctor.create({
      data: { userId, isActive: true },
      include: { user: true },
    });
  }

  async create(dto: CreateDoctorDto) {
    const userId = this.toIntId(dto.userId, 'userId');

    const existing = await this.prisma.doctor.findUnique({
      where: { userId },
    });
    if (existing) throw new BadRequestException('Doctor profile already exists for this user');

    return this.prisma.doctor.create({
      data: {
        userId,
        bio: (dto as any).bio ?? null,
        isActive: (dto as any).isActive ?? true,
      },
      include: { user: true },
    });
  }

  findAll() {
    return this.prisma.doctor.findMany({
      include: { user: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number | string) {
    const doctorId = this.toIntId(id, 'id');
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    return doctor;
  }

  async update(id: number | string, dto: UpdateDoctorDto) {
    await this.findOne(id);
    const doctorId = this.toIntId(id, 'id');

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data: {
        bio: (dto as any).bio ?? undefined,
        isActive: (dto as any).isActive ?? undefined,
        // NOTE: Doctor model has specialties/services as relations; handle via separate endpoints if needed.
      },
      include: { user: true },
    });
  }

  async remove(id: number | string) {
    await this.findOne(id);
    const doctorId = this.toIntId(id, 'id');

    return this.prisma.doctor.delete({
      where: { id: doctorId },
      include: { user: true },
    });
  }
}
