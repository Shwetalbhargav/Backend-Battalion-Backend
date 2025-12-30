import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDoctorDto) {
    if (!dto.userId) throw new BadRequestException('userId is required');

    const existing = await this.prisma.doctor.findUnique({
      where: { userId: dto.userId },
    });
    if (existing) {
      throw new BadRequestException('Doctor profile already exists for this user');
    }

    return this.prisma.doctor.create({
      data: {
        userId: dto.userId,
        specialization: dto.specialization ?? '',
        licenseNumber: dto.licenseNumber ?? '',
        experienceYears: dto.experienceYears ?? 0,
        bio: dto.bio ?? '',
      },
      include: { user: true },
    });
  }

  findAll() {
    return this.prisma.doctor.findMany({ include: { user: true } });
  }

  findOne(id: number) {
    return this.prisma.doctor.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  update(id: number, dto: UpdateDoctorDto) {
    return this.prisma.doctor.update({
      where: { id },
      data: {
        specialization: dto.specialization,
        licenseNumber: dto.licenseNumber,
        experienceYears: dto.experienceYears,
        bio: dto.bio,
      },
      include: { user: true },
    });
  }

  remove(id: number) {
    return this.prisma.doctor.delete({
      where: { id },
      include: { user: true },
    });
  }

  // Used by Google OAuth auto-create profile on first login
  async ensureDoctorProfile(userId: string) {
    const existing = await this.prisma.doctor.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.doctor.create({
      data: {
        userId,
        specialization: '',
        licenseNumber: '',
        experienceYears: 0,
        bio: '',
      },
    });
  }
}
