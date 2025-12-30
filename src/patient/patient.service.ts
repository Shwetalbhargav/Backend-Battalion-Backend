import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientDto) {
    if (!dto.userId) throw new BadRequestException('userId is required');

    const existing = await this.prisma.patient.findUnique({
      where: { userId: dto.userId },
    });
    if (existing) {
      throw new BadRequestException('Patient profile already exists for this user');
    }

    return this.prisma.patient.create({
      data: {
        userId: dto.userId,
        gender: dto.gender,
        dob: dto.dob ? new Date(dto.dob) : null,
        bloodGroup: dto.bloodGroup,
        phone: dto.phone,
      },
      include: { user: true },
    });
  }

  findAll() {
    return this.prisma.patient.findMany({ include: { user: true } });
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.findOne(id);

    return this.prisma.patient.update({
      where: { id },
      data: {
        gender: dto.gender,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        bloodGroup: dto.bloodGroup,
        phone: dto.phone,
        // userId should NOT be updatable from client
      },
      include: { user: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.patient.delete({ where: { id } });
  }

  // ✅ Used by Google OAuth "auto-create profile" (first login)
  async ensurePatientProfile(userId: string) {
    const existing = await this.prisma.patient.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.patient.create({
      data: {
        userId,
        gender: null,
        dob: null,
        bloodGroup: null,
        phone: null,
      },
    });
  }
}
