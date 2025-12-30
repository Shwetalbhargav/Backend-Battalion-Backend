import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DayOfWeek, MeetingType, SlotStatus, TimeOfDay } from '@prisma/client';
import { UpdateSlotDto } from './dto/update-slot.dto';

function normalizeToDayStartUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function dayOfWeekUTC(date: Date): DayOfWeek {
  const map: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return map[date.getUTCDay()];
}

function addMinutesToDate(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function clampMinute(min: number) {
  if (!Number.isFinite(min) || min < 0 || min > 24 * 60) {
    throw new BadRequestException('Minutes must be between 0 and 1440.');
  }
  return Math.floor(min);
}

@Injectable()
export class AvailabilitySlotsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------
  // Controller-facing methods (missing before)
  // ---------------------------

  async generateSlots(doctorId: number, dateFrom: string, dateTo: string) {
    return this.generateSlotsForDoctorRange({
      doctorId,
      fromDate: new Date(dateFrom),
      toDate: new Date(dateTo),
    });
  }

  async search(filters: {
    doctorId?: string;
    date?: string;
    meetingType?: 'ONLINE' | 'OFFLINE';
    timeOfDay?: 'MORNING' | 'EVENING';
    status?: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE';
  }) {
    const where: any = {};

    if (filters.doctorId !== undefined) {
      const parsed = Number(filters.doctorId);
      if (!Number.isFinite(parsed)) throw new BadRequestException('doctorId must be a number');
      where.doctorId = parsed;
    }

    if (filters.date) {
      const d = new Date(filters.date);
      if (isNaN(d.getTime())) throw new BadRequestException('Invalid date');
      where.date = normalizeToDayStartUTC(d);
    }

    if (filters.meetingType) where.meetingType = filters.meetingType as MeetingType;
    if (filters.timeOfDay) where.timeOfDay = filters.timeOfDay as TimeOfDay;
    if (filters.status) where.status = filters.status as SlotStatus;

    return this.prisma.availabilitySlot.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
    });
  }

  async update(id: string, dto: UpdateSlotDto) {
    const parsedId = Number(id);
    if (!Number.isFinite(parsedId)) throw new BadRequestException('id must be a number');

    const existing = await this.prisma.availabilitySlot.findUnique({ where: { id: parsedId } });
    if (!existing) throw new NotFoundException('Slot not found');

    return this.prisma.availabilitySlot.update({
      where: { id: parsedId },
      data: {
        status: dto.status as SlotStatus | undefined,
        bookedCount: dto.bookedCount ?? undefined,
      },
    });
  }

  // ---------------------------
  // Internal methods (your core logic)
  // ---------------------------

  async getActiveRules(doctorId: number) {
    return this.prisma.doctorScheduleRule.findMany({
      where: { doctorId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { timeOfDay: 'asc' }, { startMinute: 'asc' }],
    });
  }

  async generateSlotsForDoctorRange(params: { doctorId: number; fromDate: Date; toDate: Date }) {
    const { doctorId } = params;
    const from = normalizeToDayStartUTC(params.fromDate);
    const to = normalizeToDayStartUTC(params.toDate);

    if (to < from) throw new BadRequestException('toDate must be >= fromDate');

    const rules = await this.getActiveRules(doctorId);

    for (let cursor = new Date(from); cursor <= to; cursor = addMinutesToDate(cursor, 24 * 60)) {
      const dow = dayOfWeekUTC(cursor);
      const dayRules = rules.filter((r) => r.dayOfWeek === dow);
      if (!dayRules.length) continue;

      for (const r of dayRules) {
        const startMinute = clampMinute(r.startMinute);
        const endMinute = clampMinute(r.endMinute);
        const duration = clampMinute(r.slotDurationMin);

        if (endMinute <= startMinute) continue;
        if (duration <= 0) continue;

        for (let m = startMinute; m + duration <= endMinute; m += duration) {
          const startAt = addMinutesToDate(cursor, m);
          const endAt = addMinutesToDate(cursor, m + duration);
          const clinicId: number | null = r.clinicId ?? null;

          await this.prisma.availabilitySlot.upsert({
            where: {
              doctorId_date_meetingType_startMinute_endMinute: {
                doctorId,
                date: cursor,
                meetingType: r.meetingType,
                startMinute: m,
                endMinute: m + duration,
              },
            },
            create: {
              doctorId,
              clinicId,
              meetingType: r.meetingType,
              date: cursor,
              startMinute: m,
              endMinute: m + duration,
              timeOfDay: r.timeOfDay as TimeOfDay,
              startAt,
              endAt,
              capacity: r.capacityPerSlot,
              bookedCount: 0,
              status: 'AVAILABLE' as SlotStatus,
            },
            update: {
              clinicId,
              timeOfDay: r.timeOfDay as TimeOfDay,
              startAt,
              endAt,
              capacity: r.capacityPerSlot,
            },
          });
        }
      }
    }

    return { ok: true };
  }
}
