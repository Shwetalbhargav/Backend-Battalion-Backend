import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpandSessionDto } from './dto/expand-session.dto';
import { ShrinkSessionDto } from './dto/shrink-session.dto';
import { UpdateCapacityDto } from './dto/update-capacity.dto';
import {AppointmentStatus, MeetingType, TimeOfDay } from '@prisma/client';


/**
 * Normalizes a YYYY-MM-DD string to a UTC day start DateTime.
 * We store dates in DB as DateTime (UTC day start convention).
 */
function dayStartUtcFromISO(dateISO: string): Date {
  // dateISO like "2026-01-06"
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function minutesToUtcDateTime(dayStartUtc: Date, minuteOfDay: number): Date {
  return new Date(dayStartUtc.getTime() + minuteOfDay * 60_000);
}

function parseMeetingType(value: string): MeetingType {
  if (!Object.values(MeetingType).includes(value as MeetingType)) {
    throw new BadRequestException(`Invalid meetingType: ${value}`);
  }
  return value as MeetingType;
}

function parseTimeOfDay(value: string): TimeOfDay {
  if (!Object.values(TimeOfDay).includes(value as TimeOfDay)) {
    throw new BadRequestException(`Invalid timeOfDay: ${value}`);
  }
  return value as TimeOfDay;
}

@Injectable()
export class ElasticSchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  private assertMinuteWindow(start: number, end: number) {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new BadRequestException('start/end minutes must be integers');
    }
    if (start < 0 || end > 1440) {
      throw new BadRequestException('start/end minutes must be in range 0..1440');
    }
    if (start >= end) {
      throw new BadRequestException('newStartMinute must be < newEndMinute');
    }
  }

  private async getSessionOrThrow(dto: {
    doctorId: number;
    date: Date;
    meetingType: MeetingType;
   timeOfDay: TimeOfDay;
    locationKey?: string;
  }) {
    

    const session = await this.prisma.availabilitySession.findFirst({
      where: {
        doctorId: dto.doctorId,
        date: dto.date,
        meetingType: dto.meetingType,
        timeOfDay: dto.timeOfDay,
        locationKey: dto.locationKey ?? 'NONE',
      },
    });

    if (!session) {
      throw new NotFoundException('AvailabilitySession not found for doctor/date/meetingType/timeOfDay');
    }

    return session;
  }

  /**
   * Upsert behavior without relying on compound unique (avoids type issues).
   * We find existing override for (doctorId, date, meetingType, timeOfDay, locationKey)
   * and then create/update.
   */
  private async upsertOverride(args: {
    doctorId: number;
    clinicId: number | null;
    date: Date;
    meetingType: any;
    timeOfDay: any;
    locationKey: string;
    data: Partial<{
      isClosed: boolean;
      startMinute: number | null;
      endMinute: number | null;
      slotDurationMin: number | null;
      capacityPerSlot: number | null;
    }>;
  }) {
    const existing = await this.prisma.doctorSessionOverride.findFirst({
      where: {
        doctorId: args.doctorId,
        date: args.date,
        meetingType: args.meetingType,
        timeOfDay: args.timeOfDay,
        locationKey: args.locationKey,
      },
      select: { id: true },
    });

    if (!existing) {
      return this.prisma.doctorSessionOverride.create({
        data: {
          doctorId: args.doctorId,
          clinicId: args.clinicId,
          date: args.date,
          meetingType: args.meetingType,
          timeOfDay: args.timeOfDay,
          locationKey: args.locationKey,
          // defaults:
          isClosed: false,
          startMinute: null,
          endMinute: null,
          slotDurationMin: null,
          capacityPerSlot: null,
          // overrides:
          ...args.data,
        },
      });
    }

    return this.prisma.doctorSessionOverride.update({
      where: { id: existing.id },
      data: args.data,
    });
  }

  /**
   * Iteration 1: Expand session.
   * - Update session window (startMinute/endMinute)
   * - Store override for this day+session
   * - Create slots for the window if possible (best-effort)
   *
   * NOTE: We do NOT reschedule appointments here (appointment module not merged yet).
   */
  async expandSession(dto: ExpandSessionDto) {
    this.assertMinuteWindow(dto.newStartMinute, dto.newEndMinute);

   const day = dayStartUtcFromISO(dto.date);

        const session = await this.getSessionOrThrow({
          doctorId: dto.doctorId,
          date: day,
          meetingType: parseMeetingType(dto.meetingType),
          timeOfDay: parseTimeOfDay(dto.timeOfDay),
          locationKey: dto.locationKey,
        });


    // Persist override (date+session scoped)
    await this.upsertOverride({
      doctorId: session.doctorId,
      clinicId: session.clinicId ?? null,
      date: day,
      meetingType: session.meetingType,
      timeOfDay: session.timeOfDay,
      locationKey: session.locationKey,
      data: {
        isClosed: false,
        startMinute: dto.newStartMinute,
        endMinute: dto.newEndMinute,
      },
    });

    // Update session window
    await this.prisma.availabilitySession.update({
      where: { id: session.id },
      data: {
        startMinute: dto.newStartMinute,
        endMinute: dto.newEndMinute,
      },
    });

    // Best-effort slot creation:
    // We try to infer slotDurationMin from an existing slot in this session.
    const sampleSlot = await this.prisma.availabilitySlot.findFirst({
      where: { sessionId: session.id },
      orderBy: { startMinute: 'asc' },
      select: { startMinute: true, endMinute: true },
    });

    const slotDurationMin =
      sampleSlot && sampleSlot.endMinute > sampleSlot.startMinute
        ? sampleSlot.endMinute - sampleSlot.startMinute
        : 15;

    // Create many slots within new window. We avoid depending on status/capacity fields.
    const toCreate: any[] = [];
    for (let m = dto.newStartMinute; m + slotDurationMin <= dto.newEndMinute; m += slotDurationMin) {
      toCreate.push({
        sessionId: session.id,
        doctorId: session.doctorId,
        clinicId: session.clinicId,
        meetingType: session.meetingType,
        locationKey: session.locationKey,
        date: session.date,
        timeOfDay: session.timeOfDay,
        startMinute: m,
        endMinute: m + slotDurationMin,
        startAt: minutesToUtcDateTime(session.date, m),
        endAt: minutesToUtcDateTime(session.date, m + slotDurationMin),
      });
    }

    // If your schema has unique constraints preventing duplicates, skipDuplicates helps.
    // If skipDuplicates isn't supported in your prisma version, remove it.
    const created = await this.prisma.availabilitySlot.createMany({
      data: toCreate,
      skipDuplicates: true,
    });

    return {
      ok: true,
      message: 'Session expanded (override stored + session window updated + slots created best-effort)',
      createdSlots: created.count,
    };
  }

  /**
   * Iteration 2: Shrink session (WAVE/STREAM behavior will be implemented after appointment merge).
   * For now:
   * - Update session window
   * - Store override
   * - Return impacted slot range info (no rescheduling yet)
   */
  async shrinkSession(dto: ShrinkSessionDto) {
    this.assertMinuteWindow(dto.newStartMinute, dto.newEndMinute);

    const day = dayStartUtcFromISO(dto.date);

    const session = await this.getSessionOrThrow({
      doctorId: dto.doctorId,
      date: day,
      meetingType: parseMeetingType(dto.meetingType),
      timeOfDay: parseTimeOfDay(dto.timeOfDay),
      locationKey: dto.locationKey,
    });


    await this.upsertOverride({
      doctorId: session.doctorId,
      clinicId: session.clinicId ?? null,
      date: day,
      meetingType: session.meetingType,
      timeOfDay: session.timeOfDay,
      locationKey: session.locationKey,
      data: {
        isClosed: false,
        startMinute: dto.newStartMinute,
        endMinute: dto.newEndMinute,
      },
    });

    await this.prisma.availabilitySession.update({
      where: { id: session.id },
      data: {
        startMinute: dto.newStartMinute,
        endMinute: dto.newEndMinute,
      },
    });

    // Provide impacted slot IDs (best-effort) without touching appointment model
    const impactedSlots = await this.prisma.availabilitySlot.findMany({
      where: {
        sessionId: session.id,
        OR: [{ startMinute: { lt: dto.newStartMinute } }, { endMinute: { gt: dto.newEndMinute } }],
      },
      select: { id: true, startMinute: true, endMinute: true },
    });

    return {
      ok: true,
      message:
        'Session shrunk (override stored + session window updated). Appointment rehome will be added after appointment-booking merge.',
      strategy: dto.strategy,
      impactedSlotIds: impactedSlots.map((s) => s.id),
    };
  }

  /**
   * Iteration 3: Capacity update (+/-)
   * For now:
   * - Store override capacityPerSlot
   * - Return OK (we’ll implement overflow logic after appointment merge)
   */
  async updateCapacity(dto: UpdateCapacityDto) {
    if (!Number.isInteger(dto.newCapacityPerSlot) || dto.newCapacityPerSlot < 1) {
      throw new BadRequestException('newCapacityPerSlot must be an integer >= 1');
    }

    const day = dayStartUtcFromISO(dto.date);
    const session = await this.getSessionOrThrow(dto);

    await this.upsertOverride({
      doctorId: session.doctorId,
      clinicId: session.clinicId ?? null,
      date: day,
      meetingType: session.meetingType,
      timeOfDay: session.timeOfDay,
      locationKey: session.locationKey,
      data: {
        isClosed: false,
        capacityPerSlot: dto.newCapacityPerSlot,
      },
    });

    return {
      ok: true,
      message:
        'Capacity override stored. Slot/appointment overflow handling will be added after appointment-booking merge.',
      strategy: dto.strategy,
      newCapacityPerSlot: dto.newCapacityPerSlot,
    };
  }

   /**
   NEW — confirmed recurring → custom reflection helper
   */

   async getConfirmedAppointmentsForSessionKey(params: {
  doctorId: number;
  date: Date;
  meetingType: MeetingType;
  timeOfDay: TimeOfDay;
  locationKey?: string;
}) {
  return this.prisma.appointment.findMany({
    where: {
      status: AppointmentStatus.CONFIRMED,
      slot: {
        session: {
          doctorId: params.doctorId,
          date: params.date,
          meetingType: params.meetingType,
          timeOfDay: params.timeOfDay,
          locationKey: params.locationKey ?? 'NONE',
        },
      },
    },
    include: { slot: true },
  });
}


}
