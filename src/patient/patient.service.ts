import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  private toIntId(value: any, field: string): number {
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isInteger(n) || n <= 0) throw new BadRequestException(`${field} must be a positive integer`);
    return n;
  }

  async ensurePatientProfile(userIdRaw: number | string) {
    const userId = this.toIntId(userIdRaw, 'userId');

    const existing = await this.prisma.patient.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.patient.create({
      data: { userId },
      include: { user: true },
    });
  }

  async create(dto: CreatePatientDto) {
    const userId = this.toIntId(dto.userId, 'userId');

    const existing = await this.prisma.patient.findUnique({
      where: { userId },
    });
    if (existing) throw new BadRequestException('Patient profile already exists for this user');

    return this.prisma.patient.create({
      data: {
        userId,
        gender: (dto as any).gender ?? null,
        dob: (dto as any).dob ? new Date((dto as any).dob) : null,
        bloodGroup: (dto as any).bloodGroup ?? null,
        phone: (dto as any).phone ?? null,
      },
      include: { user: true },
    });
  }

  findAll() {
    return this.prisma.patient.findMany({
      include: { user: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number | string) {
    const patientId = this.toIntId(id, 'id');
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { user: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: number | string, dto: UpdatePatientDto) {
    await this.findOne(id);
    const patientId = this.toIntId(id, 'id');

    return this.prisma.patient.update({
      where: { id: patientId },
      data: {
        gender: (dto as any).gender ?? undefined,
        dob: (dto as any).dob ? new Date((dto as any).dob) : undefined,
        bloodGroup: (dto as any).bloodGroup ?? undefined,
        phone: (dto as any).phone ?? undefined,
        userId: (dto as any).userId ? this.toIntId((dto as any).userId, 'userId') : undefined,
      },
      include: { user: true },
    });
  }

  async remove(id: number | string) {
    await this.findOne(id);
    const patientId = this.toIntId(id, 'id');

    return this.prisma.patient.delete({
      where: { id: patientId },
    });
  }
}
