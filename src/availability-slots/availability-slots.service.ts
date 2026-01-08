import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MeetingType,
  SlotStatus,
  TimeOfDay,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSlotDto } from './dto/update-slot.dto';

type SearchSlotsInput = {
  doctorId: string;
  dateFrom: string;
  dateTo: string;
  meetingType?: MeetingType;
  timeOfDay?: TimeOfDay;
  status?: SlotStatus;
};

type CreateExtraSlotsInput = {
  doctorId: string;
  date: string;
  meetingType: MeetingType;
  timeOfDay: TimeOfDay;
  startMinute: number;
  endMinute: number;
  slotDurationMin?: number;
  capacity?: number;
  clinicId?: number | null;
};

function normalizeToDayStartUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function addMinutesToDate(dayStartUtc: Date, minutes: number): Date {
  return new Date(dayStartUtc.getTime() + minutes * 60_000);
}

@Injectable()
export class AvailabilitySlotsService {
  /**
   * PrismaService usually extends PrismaClient, but in some codebases it may be
   * typed loosely, which triggers @typescript-eslint/no-unsafe-* rules.
   *
   * We keep Nest DI token as PrismaService while using a strongly-typed
   * PrismaClient view internally.
   */
  private readonly db: PrismaClient;

  constructor(prisma: PrismaService) {
    this.db = prisma as unknown as PrismaClient;
  }

  private parseDoctorId(doctorId: string): number {
    const id = Number(doctorId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(
        'doctorId must be a positive integer string',
      );
    }
    return id;
  }

  private parseISODateOnly(label: string, value: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(
        `${label} must be a valid ISO date (e.g. YYYY-MM-DD)`,
      );
    }
    return normalizeToDayStartUTC(d);
  }

  /* =====================================================
     GENERATE SLOTS FROM SCHEDULE RULES
     ===================================================== */
  async generateSlots(
    doctorId: string,
    dateFromStr: string,
    dateToStr: string,
  ) {
    const did = this.parseDoctorId(doctorId);

    const from = this.parseISODateOnly('dateFrom', dateFromStr);
    const to = this.parseISODateOnly('dateTo', dateToStr);
    if (to < from) throw new BadRequestException('dateTo must be >= dateFrom');

    const rules = await this.db.doctorScheduleRule.findMany({
      where: { doctorId: did, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });

    if (rules.length === 0) {
      return { created: 0, message: 'No active schedule rules found' };
    }

    const rows: Prisma.AvailabilitySlotCreateManyInput[] = [];

    for (
      let day = new Date(from);
      day <= to;
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000)
    ) {
      const date = normalizeToDayStartUTC(day);

      const jsDow = day.getUTCDay(); // 0=Sun..6=Sat
      const dowMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dowKey = dowMap[jsDow];

      const dayRules = rules.filter(
        (r) => String(r.dayOfWeek) === dowKey,
      );

      for (const r of dayRules) {
        const slotDurationMin = Number(r.slotDurationMin ?? 15);
        const startMinute = Number(r.startMinute);
        const endMinute = Number(r.endMinute);

        if (
          !Number.isFinite(slotDurationMin) ||
          slotDurationMin <= 0 ||
          !Number.isFinite(startMinute) ||
          !Number.isFinite(endMinute) ||
          endMinute <= startMinute
        ) {
          continue;
        }

        for (
          let start = startMinute;
          start + slotDurationMin <= endMinute;
          start += slotDurationMin
        ) {
          const end = start + slotDurationMin;

          rows.push({
            doctorId: did,
            clinicId: r.clinicId ?? null,
            meetingType: r.meetingType,
            timeOfDay: r.timeOfDay,
            date,
            startMinute: start,
            endMinute: end,
            startAt: addMinutesToDate(date, start),
            endAt: addMinutesToDate(date, end),
            capacity: Number(r.capacityPerSlot ?? 1),
            bookedCount: 0,
            status: SlotStatus.AVAILABLE,
          });
        }
      }
    }

    if (rows.length === 0) {
      return { created: 0, message: 'No slots generated for the date range' };
    }

    const result = await this.db.availabilitySlot.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return { created: result.count };
  }

  /* =====================================================
     SEARCH SLOTS
     ===================================================== */
  searchSlots(input: SearchSlotsInput) {
    const did = this.parseDoctorId(input.doctorId);

    const from = this.parseISODateOnly('dateFrom', input.dateFrom);
    const to = this.parseISODateOnly('dateTo', input.dateTo);
    if (to < from) throw new BadRequestException('dateTo must be >= dateFrom');

    return this.db.availabilitySlot.findMany({
      where: {
        doctorId: did,
        date: { gte: from, lte: to },
        meetingType: input.meetingType,
        timeOfDay: input.timeOfDay,
        status: input.status,
      },
      orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
    });
  }

  /* =====================================================
     UPDATE SLOT
     ===================================================== */
  async updateSlot(id: number, dto: UpdateSlotDto) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid slot id');
    }

    const existing = await this.db.availabilitySlot.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Slot not found');

    const data: Partial<UpdateSlotDto> = {};
    (Object.keys(dto) as (keyof UpdateSlotDto)[]).forEach((key) => {
      const value = dto[key];
      if (value !== undefined) data[key] = value;
    });

    return this.db.availabilitySlot.update({
      where: { id },
      data,
    });
  }

  /* =====================================================
     CREATE EXTRA SLOTS
     ===================================================== */
  async createExtraSlots(input: CreateExtraSlotsInput) {
    const did = this.parseDoctorId(input.doctorId);
    const date = this.parseISODateOnly('date', input.date);

    const startMinute = Number(input.startMinute);
    const endMinute = Number(input.endMinute);
    if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute)) {
      throw new BadRequestException(
        'startMinute and endMinute must be numbers',
      );
    }
    if (endMinute <= startMinute) {
      throw new BadRequestException('endMinute must be > startMinute');
    }

    const slotDurationMin = Number(input.slotDurationMin ?? 15);
    if (!Number.isFinite(slotDurationMin) || slotDurationMin <= 0) {
      throw new BadRequestException(
        'slotDurationMin must be a positive number',
      );
    }

    const capacity = Number(input.capacity ?? 1);
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw new BadRequestException('capacity must be >= 1');
    }

    const rows: Prisma.AvailabilitySlotCreateManyInput[] = [];

    for (
      let start = startMinute;
      start + slotDurationMin <= endMinute;
      start += slotDurationMin
    ) {
      const end = start + slotDurationMin;

      rows.push({
        doctorId: did,
        clinicId: input.clinicId ?? null,
        meetingType: input.meetingType,
        timeOfDay: input.timeOfDay,
        date,
        startMinute: start,
        endMinute: end,
        startAt: addMinutesToDate(date, start),
        endAt: addMinutesToDate(date, end),
        capacity,
        bookedCount: 0,
        status: SlotStatus.AVAILABLE,
      });
    }

    if (rows.length === 0) return { created: 0 };

    const result = await this.db.availabilitySlot.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return { created: result.count };
  }
}
