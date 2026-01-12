import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { AppointmentStatus, MeetingType, SlotStatus, TimeOfDay } from '@prisma/client';

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  private toIntId(value: any, field: string): number {
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return n;
  }

  private parseISODateOnly(value: string, field = 'date'): Date {
    // expects YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${field} must be in YYYY-MM-DD format`);
    }
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    if (Number.isNaN(dt.getTime())) throw new BadRequestException(`${field} is invalid`);
    return dt;
  }

  private nextDayUTC(dayStartUTC: Date): Date {
    return new Date(dayStartUTC.getTime() + 24 * 60 * 60 * 1000);
  }

  // -----------------------------
  // Doctor Profile CRUD (existing)
  // -----------------------------

  async create(jwtUserId: number, dto: CreateDoctorDto) {
    const userId = this.toIntId(jwtUserId, 'userId');

    // prevent creating profile for other users even if dto includes userId
    dto.userId = userId;

    const exists = await this.prisma.doctor.findUnique({ where: { userId } });
    if (exists) {
      throw new BadRequestException('Doctor profile already exists for this user');
    }

    // Optional validation: ensure specialty/service IDs exist
    await this.validateSpecialtyIds(dto.specialtyIds);
    await this.validateServiceIds(dto.serviceIds);

    return this.prisma.doctor.create({
      data: {
        userId,
        bio: dto.bio ?? null,
        isActive: dto.isActive ?? true,

        specialties: dto.specialtyIds
          ? {
              create: dto.specialtyIds.map((specialtyId) => ({ specialtyId })),
            }
          : undefined,

        services: dto.serviceIds
          ? {
              create: dto.serviceIds.map((serviceId) => ({ serviceId })),
            }
          : undefined,
      },
      include: {
        user: true,
        specialties: { include: { specialty: true } },
        services: { include: { service: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.doctor.findMany({
      include: {
        user: true,
        specialties: { include: { specialty: true } },
        services: { include: { service: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const doctorId = this.toIntId(id, 'doctorId');

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true,
        specialties: { include: { specialty: true } },
        services: { include: { service: true } },
      },
    });

    if (!doctor) throw new NotFoundException('Doctor not found');
    return doctor;
  }

  /**
   * Only allow a doctor to update their own profile (no admin role exists).
   */
  async updateAsDoctor(jwtUserId: number, doctorIdRaw: number, dto: UpdateDoctorDto) {
    const userId = this.toIntId(jwtUserId, 'userId');
    const doctorId = this.toIntId(doctorIdRaw, 'doctorId');

    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    if (doctor.userId !== userId) {
      throw new ForbiddenException('You can only update your own doctor profile');
    }

    // never allow changing ownership
    delete (dto as any).userId;

    await this.validateSpecialtyIds(dto.specialtyIds);
    await this.validateServiceIds(dto.serviceIds);

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data: {
        bio: dto.bio ?? undefined,
        isActive: dto.isActive ?? undefined,

        // Replace ALL specialties if provided
        specialties: dto.specialtyIds
          ? {
              deleteMany: {},
              create: dto.specialtyIds.map((specialtyId) => ({ specialtyId })),
            }
          : undefined,

        // Replace ALL services if provided
        services: dto.serviceIds
          ? {
              deleteMany: {},
              create: dto.serviceIds.map((serviceId) => ({ serviceId })),
            }
          : undefined,
      },
      include: {
        user: true,
        specialties: { include: { specialty: true } },
        services: { include: { service: true } },
      },
    });
  }

  /**
   * Only allow doctor to delete their own profile.
   */
  async removeAsDoctor(jwtUserId: number, doctorIdRaw: number) {
    const userId = this.toIntId(jwtUserId, 'userId');
    const doctorId = this.toIntId(doctorIdRaw, 'doctorId');

    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    if (doctor.userId !== userId) {
      throw new ForbiddenException('You can only delete your own doctor profile');
    }

    return this.prisma.doctor.delete({ where: { id: doctorId } });
  }

  // -----------------------------------
  // Ensure doctor profile exists for "me"
  // -----------------------------------
  async ensureDoctorProfile(jwtUserId: number) {
    const userId = this.toIntId(jwtUserId, 'userId');

    const existing = await this.prisma.doctor.findUnique({ where: { userId } });
    if (existing) return existing;

    // Create minimal profile if missing (optional behavior)
    return this.prisma.doctor.create({
      data: { userId, bio: null, isActive: true },
    });
  }

  // -----------------------------------
  // Mapping: Doctor (me) <-> Specialties
  // -----------------------------------

  async listMySpecialties(jwtUserId: number) {
    const doctor = await this.ensureDoctorProfile(jwtUserId);

    const rows = await this.prisma.doctorSpecialty.findMany({
      where: { doctorId: doctor.id },
      include: { specialty: true },
      orderBy: { specialty: { name: 'asc' } },
    });

    return rows.map((r) => r.specialty);
  }

  async addSpecialtyToMe(jwtUserId: number, specialtyIdRaw: number) {
    const specialtyId = this.toIntId(specialtyIdRaw, 'specialtyId');
    const doctor = await this.ensureDoctorProfile(jwtUserId);

    const specialty = await this.prisma.specialty.findUnique({ where: { id: specialtyId } });
    if (!specialty) throw new NotFoundException('Specialty not found');

    try {
      await this.prisma.doctorSpecialty.create({
        data: { doctorId: doctor.id, specialtyId },
      });
    } catch {
      throw new BadRequestException('Specialty already added');
    }

    return this.listMySpecialties(jwtUserId);
  }

  async removeSpecialtyFromMe(jwtUserId: number, specialtyIdRaw: number) {
    const specialtyId = this.toIntId(specialtyIdRaw, 'specialtyId');
    const doctor = await this.ensureDoctorProfile(jwtUserId);

    await this.prisma.doctorSpecialty.delete({
      where: { doctorId_specialtyId: { doctorId: doctor.id, specialtyId } },
    });

    return this.listMySpecialties(jwtUserId);
  }

  // -----------------------------------
  // Mapping: Doctor (me) <-> Services
  // -----------------------------------

  async listMyServices(jwtUserId: number) {
    const doctor = await this.ensureDoctorProfile(jwtUserId);

    const rows = await this.prisma.doctorService.findMany({
      where: { doctorId: doctor.id },
      include: { service: true },
      orderBy: { service: { name: 'asc' } },
    });

    return rows.map((r) => r.service);
  }

  async addServiceToMe(jwtUserId: number, serviceIdRaw: number) {
    const serviceId = this.toIntId(serviceIdRaw, 'serviceId');
    const doctor = await this.ensureDoctorProfile(jwtUserId);

    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Service not found');

    try {
      await this.prisma.doctorService.create({
        data: { doctorId: doctor.id, serviceId },
      });
    } catch {
      throw new BadRequestException('Service already added');
    }

    return this.listMyServices(jwtUserId);
  }

  async removeServiceFromMe(jwtUserId: number, serviceIdRaw: number) {
    const serviceId = this.toIntId(serviceIdRaw, 'serviceId');
    const doctor = await this.ensureDoctorProfile(jwtUserId);

    await this.prisma.doctorService.delete({
      where: { doctorId_serviceId: { doctorId: doctor.id, serviceId } },
    });

    return this.listMyServices(jwtUserId);
  }

  // -----------------------------
  // Search Doctors
  // -----------------------------

  async searchDoctorsBySpecialty(params: { specialtyId?: number; name?: string }) {
    const { specialtyId, name } = params;
    if (!specialtyId && !name) throw new BadRequestException('Provide specialtyId or name');

    return this.prisma.doctor.findMany({
      where: {
        isActive: true,
        specialties: specialtyId
          ? { some: { specialtyId } }
          : { some: { specialty: { name: { contains: name!, mode: 'insensitive' } } } },
      },
      include: {
        user: true,
        specialties: { include: { specialty: true } },
        services: { include: { service: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async searchDoctorsByAvailability(params: {
    date: string; // YYYY-MM-DD
    meetingType?: MeetingType;
    timeOfDay?: TimeOfDay;
    startMinute?: number;
    endMinute?: number;
  }) {
    const dayStart = this.parseISODateOnly(params.date, 'date');
    const dayEnd = this.nextDayUTC(dayStart);

    const whereSlot: any = {
      date: { gte: dayStart, lt: dayEnd },
      status: SlotStatus.AVAILABLE,
    };

    if (params.meetingType) whereSlot.meetingType = params.meetingType;

    // timeOfDay is on AvailabilitySession (per your schema)
    if (params.timeOfDay) whereSlot.session = { timeOfDay: params.timeOfDay };

    if (params.startMinute !== undefined) whereSlot.startMinute = { gte: params.startMinute };
    if (params.endMinute !== undefined) whereSlot.endMinute = { lte: params.endMinute };

    return this.prisma.doctor.findMany({
      where: {
        isActive: true,
        slots: { some: whereSlot },
      },
      include: {
        user: true,
        specialties: { include: { specialty: true } },
        services: { include: { service: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async searchDoctorsByAppointments(params: {
    status?: AppointmentStatus;
    from?: string; // YYYY-MM-DD
    to?: string;   // YYYY-MM-DD inclusive
  }) {
    const whereAppt: any = {};
    if (params.status) whereAppt.status = params.status;

    if (params.from) {
      const from = this.parseISODateOnly(params.from, 'from');
      whereAppt.createdAt = { ...(whereAppt.createdAt ?? {}), gte: from };
    }

    if (params.to) {
      const toStart = this.parseISODateOnly(params.to, 'to');
      const toExclusive = this.nextDayUTC(toStart);
      whereAppt.createdAt = { ...(whereAppt.createdAt ?? {}), lt: toExclusive };
    }

    return this.prisma.doctor.findMany({
      where: {
        isActive: true,
        appointments: { some: whereAppt },
      },
      include: {
        user: true,
        specialties: { include: { specialty: true } },
        services: { include: { service: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  // -----------------------------
  // Validation helpers
  // -----------------------------

  private async validateSpecialtyIds(ids?: number[]) {
    if (!ids) return;
    const unique = Array.from(new Set(ids.map((x) => this.toIntId(x, 'specialtyId'))));
    const count = await this.prisma.specialty.count({ where: { id: { in: unique } } });
    if (count !== unique.length) {
      throw new BadRequestException('One or more specialtyIds are invalid');
    }
  }

  private async validateServiceIds(ids?: number[]) {
    if (!ids) return;
    const unique = Array.from(new Set(ids.map((x) => this.toIntId(x, 'serviceId'))));
    const count = await this.prisma.service.count({ where: { id: { in: unique } } });
    if (count !== unique.length) {
      throw new BadRequestException('One or more serviceIds are invalid');
    }
  }
}
