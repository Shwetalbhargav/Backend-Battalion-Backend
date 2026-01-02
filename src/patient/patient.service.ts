import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  private toInt(value: unknown, fieldName: string): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException(`${fieldName} must be a positive integer`);
    }
    return n;
  }

  async create(dto: CreatePatientDto) {
    const userId = this.toInt(dto.userId, 'userId');

    const existing = await this.prisma.patient.findUnique({
      where: { userId },
    });
    if (existing) throw new BadRequestException('Patient profile already exists for this user');

    return this.prisma.patient.create({
      data: {
        userId,
        gender: dto.gender,
        dob: dto.dob ? new Date(dto.dob) : undefined,
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
    const patientId = this.toInt(id, 'id');

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { user: true },
    });

    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto) {
    const patientId = this.toInt(id, 'id');
    await this.findOne(String(patientId));

    const data: any = {
      gender: dto.gender,
      dob: dto.dob ? new Date(dto.dob) : undefined,
      bloodGroup: dto.bloodGroup,
      phone: dto.phone,
    };

    // IMPORTANT: only set userId if provided
    if (dto.userId !== undefined) {
      data.userId = this.toInt(dto.userId, 'userId');
    }

    return this.prisma.patient.update({
      where: { id: patientId },
      data,
      include: { user: true },
    });
  }

  async remove(id: string) {
    const patientId = this.toInt(id, 'id');
    await this.findOne(String(patientId));

    return this.prisma.patient.delete({
      where: { id: patientId },
    });
  }
}
