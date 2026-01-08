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

    if (dto.userId === undefined || dto.userId === null) {
      throw new BadRequestException('userId is required');
    }


    const existing = await this.prisma.patient.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new BadRequestException('Patient profile already exists for this userId');
    }

    return this.prisma.patient.create({
      data: {

        userId,
        gender: (dto as any).gender ?? null,
        dob: (dto as any).dob ? new Date((dto as any).dob) : null,

        userId: dto.userId,
        gender: (dto as any).gender ?? null,
        dob: (dto as any).dob ?? null,

        bloodGroup: (dto as any).bloodGroup ?? null,
        phone: (dto as any).phone ?? null,
      },
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

  async findOne(id: number) {
    const p = await this.prisma.patient.findUnique({
      where: { id },

      include: { user: true },
    });
    if (!p) throw new NotFoundException('Patient not found');
    return p;
  }


  async update(id: number | string, dto: UpdatePatientDto) {
    await this.findOne(id);
    const patientId = this.toIntId(id, 'id');


  async update(id: number, dto: UpdatePatientDto) {
    await this.findOne(id);

    return this.prisma.patient.update({
      where: { id: patientId },
      data: {
        gender: (dto as any).gender ?? undefined,

        dob: (dto as any).dob ? new Date((dto as any).dob) : undefined,
        bloodGroup: (dto as any).bloodGroup ?? undefined,
        phone: (dto as any).phone ?? undefined,
        userId: (dto as any).userId ? this.toIntId((dto as any).userId, 'userId') : undefined,

        dob: (dto as any).dob ?? undefined,
        bloodGroup: (dto as any).bloodGroup ?? undefined,
        phone: (dto as any).phone ?? undefined,

      },
    });
  }


  async remove(id: number | string) {
    await this.findOne(id);
    const patientId = this.toIntId(id, 'id');

    return this.prisma.patient.delete({
      where: { id: patientId },

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.patient.delete({ where: { id } });
  }

  // ✅ FIX: userId is Int => number
  async ensurePatientProfile(userId: number) {
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
