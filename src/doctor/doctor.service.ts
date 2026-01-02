import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  private toInt(value: unknown, field: string): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return n;
  }

  async create(dto: CreateDoctorDto) {
    const userId = this.toInt((dto as any).userId, 'userId');

    // prevent duplicate profile for same user
    const existing = await this.prisma.doctor.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new BadRequestException('Doctor profile already exists for this user');
    }

    return this.prisma.doctor.create({
      data: {
        userId,
        bio: (dto as any).bio ?? undefined,
        isActive: (dto as any).isActive ?? true,
      },
      include: { user: true },
    });
  }

  findAll(query?: { userId?: string; isActive?: string }) {
    const where: any = {};

    if (query?.userId) {
      where.userId = this.toInt(query.userId, 'userId');
    }

    if (query?.isActive !== undefined) {
      if (query.isActive === 'true') where.isActive = true;
      else if (query.isActive === 'false') where.isActive = false;
      else throw new BadRequestException('isActive must be "true" or "false"');
    }

    return this.prisma.doctor.findMany({
      where,
      include: { user: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: string) {
    const doctorId = this.toInt(id, 'id');

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });

    if (!doctor) throw new NotFoundException('Doctor not found');
    return doctor;
  }

  async update(id: string, dto: UpdateDoctorDto) {
    const doctorId = this.toInt(id, 'id');
    await this.findOne(String(doctorId));

    const data: any = {
      bio: (dto as any).bio ?? undefined,
      isActive: (dto as any).isActive ?? undefined,
    };

    if ((dto as any).userId !== undefined) {
      data.userId = this.toInt((dto as any).userId, 'userId');
    }

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data,
      include: { user: true },
    });
  }

  async remove(id: string) {
    const doctorId = this.toInt(id, 'id');
    await this.findOne(String(doctorId));

    return this.prisma.doctor.delete({
      where: { id: doctorId },
      include: { user: true },
    });
  }
}
