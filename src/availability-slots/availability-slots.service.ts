import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DayOfWeek, MeetingType, SlotStatus, TimeOfDay } from '@prisma/client';
import { UpdateSlotDto } from './dto/update-slot.dto';

function normalizeToDayStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function addMinutesToDate(dayStartUtc: Date, minutes: number): Date {
  return new Date(dayStartUtc.getTime() + minutes * 60_000);
}

function dayOfWeekUTC(date: Date): DayOfWeek {
  // JS getUTCDay(): 0=Sun..6=Sat
  const map: DayOfWeek[] = [
    DayOfWeek.SUN,
    DayOfWeek.MON,
    DayOfWeek.TUE,
    DayOfWeek.WED,
    DayOfWeek.THU,
    DayOfWeek.FRI,
    DayOfWeek.SAT,
  ];
  return map[date.getUTCDay()];
}

@Injectable()
export class AvailabilitySlotsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDoctorId(doctorId: string): number {
    const id = Number(doctorId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('doctorId must be a positive integer string');
    }
    return id;
  }

  private buildLocationKey(input: {
    meetingType: MeetingType;
    clinicId: number | null | undefined;
    startMinute: number;
    endMinute: number;
  }): string {
    const clinicPart = input.clinicId ? `CLINIC:${input.clinicId}` : 'NOCLINIC';
    // Include time range to avoid collisions if multiple sessions exist for same day/timeOfDay.
    return `${input.meetingType}:${clinicPart}:${input.startMinute}-${input.endMinute}`;
  }

  async generateSlots(doctorId: string, dateFromStr: string, dateToStr: string) {
    const did = this.parseDoctorId(doctorId);

    const from = normalizeToDayStartUTC(new Date(dateFromStr));
    const to = normalizeToDayStartUTC(new Date(dateToStr));

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('dateFrom/dateTo must be valid ISO dates (YYYY-MM-DD)');
    }
    if (to < from) {
      throw new BadRequestException('dateTo must be >= dateFrom');
    }

    let created = 0;

    // inclusive loop by day
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
      const dow = dayOfWeekUTC(d);
      const date = normalizeToDayStartUTC(d);

      const rules = await this.prisma.doctorScheduleRule.findMany({
        where: { doctorId: did, dayOfWeek: dow, isActive: true },
      });

      if (!rules.length) continue;

      const rows: Array<{
        sessionId: number;
        doctorId: number;
        clinicId: number | null;
        meetingType: MeetingType;
        locationKey: string;
        date: Date;
        timeOfDay: TimeOfDay;
        startMinute: number;
        endMinute: number;
        startAt: Date;
        endAt: Date;
        capacity: number;
        bookedCount: number;
        status: SlotStatus;
      }> = [];

      for (const rule of rules) {
        const duration = rule.slotDurationMin;
        const range = rule.endMinute - rule.startMinute;
        const count = Math.floor(range / duration);
        if (count <= 0) continue;

        const locationKey = this.buildLocationKey({
          meetingType: rule.meetingType,
          clinicId: rule.clinicId,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
        });

        // Avoid relying on Prisma's generated compound-unique key name:
        // do findFirst + create instead of upsert.
        const existingSession = await this.prisma.availabilitySession.findFirst({
          where: {
            doctorId: did,
            date,
            meetingType: rule.meetingType,
            timeOfDay: rule.timeOfDay,
            locationKey,
          },
        });

        const session =
          existingSession ??
          (await this.prisma.availabilitySession.create({
            data: {
              doctorId: did,
              clinicId: rule.clinicId,
              meetingType: rule.meetingType,
              date,
              timeOfDay: rule.timeOfDay,
              locationKey,
              startMinute: rule.startMinute,
              endMinute: rule.endMinute,
            },
          }));

        for (let i = 0; i < count; i++) {
          const startMinute = rule.startMinute + i * duration;
          const endMinute = startMinute + duration;

          rows.push({
            sessionId: session.id,
            doctorId: did,
            clinicId: rule.clinicId,
            meetingType: rule.meetingType,
            locationKey,
            date,
            timeOfDay: rule.timeOfDay,
            startMinute,
            endMinute,
            startAt: addMinutesToDate(date, startMinute),
            endAt: addMinutesToDate(date, endMinute),
            capacity: rule.capacityPerSlot,
            bookedCount: 0,
            status: SlotStatus.AVAILABLE,
          });
        }
      }

      if (rows.length === 0) continue;

      const res = await this.prisma.availabilitySlot.createMany({
        data: rows,
        skipDuplicates: true,
      });

      created += res.count;
    }

    return { created };
  }

  async searchSlots(query: {
    doctorId: string;
    dateFrom: string;
    dateTo: string;
    meetingType?: MeetingType;
    timeOfDay?: TimeOfDay;
    status?: SlotStatus;
  }) {
    const did = this.parseDoctorId(query.doctorId);
    const from = normalizeToDayStartUTC(new Date(query.dateFrom));
    const to = normalizeToDayStartUTC(new Date(query.dateTo));

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('dateFrom/dateTo must be valid ISO dates (YYYY-MM-DD)');
    }
    if (to < from) {
      throw new BadRequestException('dateTo must be >= dateFrom');
    }

    return this.prisma.availabilitySlot.findMany({
      where: {
        doctorId: did,
        date: { gte: from, lte: to },
        meetingType: query.meetingType,
        status: query.status,
        session: query.timeOfDay ? { timeOfDay: query.timeOfDay } : undefined,
      },
      orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
    });
  }

  async createExtraSlots(input: {
    doctorId: string;
    date: string;
    meetingType: 'ONLINE' | 'OFFLINE';
    timeOfDay: 'MORNING' | 'EVENING';
    startMinute: number;
    endMinute: number;
    slotDurationMin?: number;
    capacity?: number;
  }) {
    const did = this.parseDoctorId(input.doctorId);
    const date = normalizeToDayStartUTC(new Date(input.date));

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date must be a valid ISO date (YYYY-MM-DD)');
    }

    const slotDuration = input.slotDurationMin ?? 15;
    const capacity = input.capacity ?? 1;

    const range = input.endMinute - input.startMinute;
    const count = Math.floor(range / slotDuration);
    if (count <= 0) {
      throw new BadRequestException('Invalid time range / slotDurationMin');
    }

    const meetingType = input.meetingType as MeetingType;
    const timeOfDay = input.timeOfDay as TimeOfDay;

    const locationKey = this.buildLocationKey({
      meetingType,
      clinicId: null,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
    });

    const existingSession = await this.prisma.availabilitySession.findFirst({
      where: {
        doctorId: did,
        date,
        meetingType,
        timeOfDay,
        locationKey,
      },
    });

    const session =
      existingSession ??
      (await this.prisma.availabilitySession.create({
        data: {
          doctorId: did,
          clinicId: null,
          meetingType,
          date,
          timeOfDay,
          locationKey,
          startMinute: input.startMinute,
          endMinute: input.endMinute,
        },
      }));

    const rows = Array.from({ length: count }).map((_, i) => {
      const startMinute = input.startMinute + i * slotDuration;
      const endMinute = startMinute + slotDuration;

      return {
        sessionId: session.id,
        doctorId: did,
        clinicId: null,
        meetingType,
        locationKey,
        date,
        timeOfDay,
        startMinute,
        endMinute,
        startAt: addMinutesToDate(date, startMinute),
        endAt: addMinutesToDate(date, endMinute),
        capacity,
        bookedCount: 0,
        status: SlotStatus.AVAILABLE,
      };
    });

    const res = await this.prisma.availabilitySlot.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return { created: res.count };
  }

  async updateSlot(slotId: number, dto: UpdateSlotDto) {
    const existing = await this.prisma.availabilitySlot.findUnique({ where: { id: slotId } });
    if (!existing) throw new NotFoundException('Slot not found');

    // Only allow updates for provided fields
    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.bookedCount !== undefined) data.bookedCount = dto.bookedCount;

    return this.prisma.availabilitySlot.update({
      where: { id: slotId },
      data,
    });
  }
}
