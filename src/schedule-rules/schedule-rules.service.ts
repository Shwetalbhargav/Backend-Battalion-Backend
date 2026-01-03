// src/schedule-rules/schedule-rules.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';
import { GenerateSlotsRangeDto } from './dto/generate-slots-range.dto';
import { UpsertDayOverrideDto } from './dto/upsert-day-override.dto';
import { UpsertSessionOverrideDto } from './dto/upsert-session-override.dto';

// If you already have AvailabilitySlotsService, inject it and call it here.
// import { AvailabilitySlotsService } from '../availability-slots/availability-slots.service';

@Injectable()
export class ScheduleRulesService {
  constructor(
    private readonly prisma: PrismaService,
    // private readonly availabilitySlotsService: AvailabilitySlotsService,
  ) {}

  private toInt(value: unknown, field: string): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return n;
  }

  async create(dto: CreateScheduleRuleDto) {
    const doctorId = this.toInt(dto.doctorId, 'doctorId');

    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new BadRequestException(`doctorId ${doctorId} not found`);

    return this.prisma.doctorScheduleRule.create({
      data: {
        doctorId,
        clinicId: dto.clinicId ?? null,
        meetingType: dto.meetingType,
        dayOfWeek: dto.dayOfWeek,
        timeOfDay: dto.timeOfDay,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        slotDurationMin: dto.slotDurationMin ?? 15,
        capacityPerSlot: dto.capacityPerSlot ?? 1,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(doctorId?: string) {
    const where = doctorId ? { doctorId: this.toInt(doctorId, 'doctorId') } : {};
    return this.prisma.doctorScheduleRule.findMany({
      where,
      orderBy: [
        { doctorId: 'asc' },
        { dayOfWeek: 'asc' },
        { timeOfDay: 'asc' },
        { startMinute: 'asc' },
      ],
    });
  }

  async findOne(id: number) {
    const rule = await this.prisma.doctorScheduleRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`Schedule rule ${id} not found`);
    return rule;
  }

  async update(id: number, dto: UpdateScheduleRuleDto) {
    await this.findOne(id);

    return this.prisma.doctorScheduleRule.update({
      where: { id },
      data: {
        clinicId: dto.clinicId ?? undefined,
        meetingType: dto.meetingType ?? undefined,
        dayOfWeek: dto.dayOfWeek ?? undefined,
        timeOfDay: dto.timeOfDay ?? undefined,
        startMinute: dto.startMinute ?? undefined,
        endMinute: dto.endMinute ?? undefined,
        slotDurationMin: dto.slotDurationMin ?? undefined,
        capacityPerSlot: dto.capacityPerSlot ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.doctorScheduleRule.delete({ where: { id } });
  }

  /**
   * Bulk generate sessions/slots between dateFrom and dateTo.
   * You can wire this to AvailabilitySlotsService.generateSlots().
   */
  async generateSlots(dto: GenerateSlotsRangeDto) {
    const doctorId = this.toInt(dto.doctorId, 'doctorId');

    const dateFrom = new Date(dto.dateFrom);
    const dateTo = new Date(dto.dateTo);

    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      throw new BadRequestException('dateFrom/dateTo must be valid ISO dates');
    }
    if (dateTo <= dateFrom) {
      throw new BadRequestException('dateTo must be after dateFrom');
    }

    // Recommended:
    // return this.availabilitySlotsService.generateSlots(doctorId, dto.dateFrom, dto.dateTo);

    return {
      message: 'Hook up to AvailabilitySlotsService.generateSlots(doctorId, dateFrom, dateTo)',
      doctorId,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
    };
  }

  async upsertDayOverride(dto: UpsertDayOverrideDto) {
    const doctorId = this.toInt(dto.doctorId, 'doctorId');
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('date must be valid ISO date');

    return this.prisma.doctorDayOverride.upsert({
      where: { doctorId_date: { doctorId, date } },
      create: {
        doctorId,
        date,
        isClosed: dto.isClosed ?? true,
        note: dto.note ?? null,
      },
      update: {
        isClosed: dto.isClosed ?? true,
        note: dto.note ?? null,
      },
    });
  }

  async upsertSessionOverride(dto: UpsertSessionOverrideDto) {
    const doctorId = this.toInt(dto.doctorId, 'doctorId');
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('date must be valid ISO date');

    return this.prisma.doctorSessionOverride.upsert({
      where: {
        doctorId_date_meetingType_timeOfDay_locationKey: {
          doctorId,
          date,
          meetingType: dto.meetingType,
          timeOfDay: dto.timeOfDay,
          locationKey: dto.locationKey ?? 'NONE',
        },
      },
      create: {
        doctorId,
        clinicId: dto.clinicId ?? null,
        date,
        meetingType: dto.meetingType,
        timeOfDay: dto.timeOfDay,
        locationKey: dto.locationKey ?? 'NONE',
        isClosed: dto.isClosed ?? false,
        startMinute: dto.startMinute ?? null,
        endMinute: dto.endMinute ?? null,
        slotDurationMin: dto.slotDurationMin ?? null,
        capacityPerSlot: dto.capacityPerSlot ?? null,
        note: dto.note ?? null,
      },
      update: {
        clinicId: dto.clinicId ?? undefined,
        isClosed: dto.isClosed ?? undefined,
        startMinute: dto.startMinute ?? undefined,
        endMinute: dto.endMinute ?? undefined,
        slotDurationMin: dto.slotDurationMin ?? undefined,
        capacityPerSlot: dto.capacityPerSlot ?? undefined,
        note: dto.note ?? undefined,
      },
    });
  }
}
