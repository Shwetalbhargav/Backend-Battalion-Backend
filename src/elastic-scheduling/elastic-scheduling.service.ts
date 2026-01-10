// src/elastic-scheduling/elastic-scheduling.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus, SlotStatus, SchedulingStrategy } from '@prisma/client';
import { ExpandSessionDto } from './dto/expand-session.dto';
import { ShrinkSessionDto } from './dto/shrink-session.dto';
import { UpdateCapacityDto } from './dto/update-capacity.dto';
import { AppointmentRescheduleOffersService } from '../reschedule-offers/appointment-reschedule-offers.service';

function dayStartUtcFromISO(dateISO: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function nowUtcMinuteOfDay(): number {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

@Injectable()
export class ElasticSchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rescheduleOffersService: AppointmentRescheduleOffersService,
  ) {}

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
  
  private minutesSinceDayStartUtc(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

private buildUtcDateTime(dayStartUtc: Date, minuteOfDay: number): Date {
  return new Date(dayStartUtc.getTime() + minuteOfDay * 60_000);
}

  private async getSessionOrThrow(dto: {
    doctorId: number;
    date: string;
    meetingType: any;
    timeOfDay: any;
  }) {
    const day = dayStartUtcFromISO(dto.date);

    const session = await this.prisma.availabilitySession.findFirst({
      where: {
        doctorId: dto.doctorId,
        date: day,
        meetingType: dto.meetingType,
        timeOfDay: dto.timeOfDay,
      },
    });

    if (!session) {
      throw new NotFoundException('AvailabilitySession not found for doctor/date/meetingType/timeOfDay');
    }
    return session;
  }

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
          isClosed: false,
          startMinute: null,
          endMinute: null,
          slotDurationMin: null,
          capacityPerSlot: null,
          ...args.data,
        },
      });
    }

    return this.prisma.doctorSessionOverride.update({
      where: { id: existing.id },
      data: args.data,
    });
  }

  private async assertSessionActiveOrThrow(session: {
  id: number;
  date: Date;
  startMinute: number;
  endMinute: number;
  doctorId: number;
  meetingType: any;
  timeOfDay: any;
}, bufferMinutes: number) {
  const now = new Date();

  const todayStartUtc = dayStartUtcFromISO(now.toISOString().slice(0, 10));
  const sessionDayStartUtc = session.date;

  // Hard reject past sessions (you can relax if you want, but matches "active" intent)
  if (sessionDayStartUtc.getTime() < todayStartUtc.getTime()) {
    throw new BadRequestException('Session is in the past and cannot be modified.');
  }

  const sessionStartAt = this.buildUtcDateTime(sessionDayStartUtc, session.startMinute);
  const sessionEndAt   = this.buildUtcDateTime(sessionDayStartUtc, session.endMinute);

  // 1) today OR 2) already started (covers today-started case cleanly)
  const isToday = sessionDayStartUtc.getTime() === todayStartUtc.getTime();
  const hasStarted = now >= sessionStartAt && now < sessionEndAt;

  if (isToday || hasStarted) return;

  // 3) booked appointments within buffer horizon (e.g., session is "tomorrow" but starts soon)
  const horizonEnd = new Date(now.getTime() + bufferMinutes * 60_000);

  const apptCount = await this.prisma.appointment.count({
  where: {
    doctorId: session.doctorId,
    status: { in: ['BOOKED', 'CONFIRMED'] },
    slot: {
      sessionId: session.id,
      startMinute: { gte: this.minutesSinceDayStartUtc(now), lte: this.minutesSinceDayStartUtc(horizonEnd) },
    },
  },
});


  if (apptCount > 0) return;

  throw new BadRequestException('Session is not ACTIVE and cannot be modified via elastic override.');
}


  async expandSession(dto: ExpandSessionDto) {
    // unchanged from your file
    this.assertMinuteWindow(dto.newStartMinute, dto.newEndMinute);

    const day = dayStartUtcFromISO(dto.date);
    const session = await this.getSessionOrThrow(dto);

      // pick a single buffer source of truth (dto override OR default)
      const bufferMinutes = dto.bufferMinutes ?? 15;

      await this.assertSessionActiveOrThrow(session, bufferMinutes);


    const oldStart = session.startMinute;
    const oldEnd = session.endMinute;
    const newStart = dto.newStartMinute;
    const newEnd = dto.newEndMinute;

    // elastic-scheduling.service.ts (inside expandSession)

        const bufferMin = dto.bufferMinutes ?? 15;
        const nowMin = nowUtcMinuteOfDay();
        const protectedUntilMin = Math.min(1440, nowMin + bufferMin);

        // 1) Check if we have pending displaced appointments (unresolved SHRINK offer groups)
        const pendingDisplacements = await this.rescheduleOffersService.findPendingDisplacementGroupsForSession({
          sessionId: session.id,
          limit: 200,
        });

      const hasDisplacements = pendingDisplacements.length > 0;


    if (newStart > oldStart || newEnd < oldEnd) {
      throw new BadRequestException('expandSession only supports EXPAND. Use shrinkSession for reducing window.');
    }

    await this.upsertOverride({
      doctorId: session.doctorId,
      clinicId: session.clinicId ?? null,
      date: day,
      meetingType: session.meetingType,
      timeOfDay: session.timeOfDay,
      locationKey: session.locationKey,
      data: {
        isClosed: false,
        startMinute: newStart,
        endMinute: newEnd,
      },
    });

    await this.prisma.availabilitySession.update({
      where: { id: session.id },
      data: { startMinute: newStart, endMinute: newEnd },
    });

    const sampleSlot = await this.prisma.availabilitySlot.findFirst({
      where: { sessionId: session.id },
      orderBy: { startMinute: 'asc' },
      select: { startMinute: true, endMinute: true, capacity: true },
    });

    const slotDurationMin =
      sampleSlot && sampleSlot.endMinute > sampleSlot.startMinute ? sampleSlot.endMinute - sampleSlot.startMinute : 15;

    const capacity = sampleSlot?.capacity ?? 1;

    const toCreate: Array<any> = [];

    if (newStart < oldStart) {
      for (let m = newStart; m + slotDurationMin <= oldStart; m += slotDurationMin) {
        toCreate.push({
          sessionId: session.id,
          doctorId: session.doctorId,
          clinicId: session.clinicId,
          meetingType: session.meetingType,
          locationKey: session.locationKey,
          date: session.date,
          startMinute: m,
          endMinute: m + slotDurationMin,
          capacity,
          bookedCount: 0,
          status: hasDisplacements ? SlotStatus.UNAVAILABLE : SlotStatus.AVAILABLE, // 👈 key
        });

        
      }
    }

    if (newEnd > oldEnd) {
      for (let m = oldEnd; m + slotDurationMin <= newEnd; m += slotDurationMin) {
        toCreate.push({
          sessionId: session.id,
          doctorId: session.doctorId,
          clinicId: session.clinicId,
          meetingType: session.meetingType,
          locationKey: session.locationKey,
          date: session.date,
          startMinute: m,
          endMinute: m + slotDurationMin,
          status: SlotStatus.AVAILABLE,
          capacity,
          bookedCount: 0,
        });
      }
    }

    const created = toCreate.length
  ? await this.prisma.availabilitySlot.createMany({ data: toCreate, skipDuplicates: true })
  : { count: 0 };

// 2) If displacements exist, allocate them BEFORE opening slots for booking
let displacementResult = null;

if (hasDisplacements) {
  // allocate using session strategy (dto override allowed)
  const strategy = (dto.strategy ?? session.strategy) as SchedulingStrategy;

  displacementResult = await this.rescheduleOffersService.allocatePendingDisplacementsForSession({
    sessionId: session.id,
    doctorId: session.doctorId,
    date: session.date,
    strategy,
    protectedUntilMinute: protectedUntilMin,
    sessionStartMinute: newStart,
    sessionEndMinute: newEnd,
    limit: 200,
  });

  // 3) Only AFTER attempting allocation, open remaining NEW slots
  await this.prisma.availabilitySlot.updateMany({
    where: {
      sessionId: session.id,
      bookedCount: 0,
      status: SlotStatus.AVAILABLE,
      // optionally restrict to only added windows; simplest is "only newly created" but createMany doesn't return IDs
      startMinute: {
        // open only the newly added ranges
        ...(newStart < oldStart ? { gte: newStart, lt: oldStart } : {}),
        ...(newEnd > oldEnd ? { gte: oldEnd, lt: newEnd } : {}),
      } as any,
    },
    data: { status: SlotStatus.AVAILABLE},
  });
}
return {
  ok: true,
  message: hasDisplacements
    ? 'Session expanded; displaced appointments allocated before opening new slots'
    : 'Session expanded (override stored + session updated + added-window slots created)',
  createdSlots: created.count,
  displaced: displacementResult,
};

  }

  /**
   * Phase 3: SHRINK end-to-end
   * - Keep impacted detection (already good)
   * - Strategy-aware offer generation (WAVE / STREAM)
   * - Persist offers via RescheduleOffersService.createOffers(...)
   * - Return impacted ids + offer groups + autoMoveSlotId + expiresAt
   *
   * Flow matches Iteration 2: find impacted -> find next 3 -> if any lacks 3 -> SHRINK NOT SAFE. :contentReference[oaicite:2]{index=2}
   */
  async shrinkSession(dto: ShrinkSessionDto) {
    this.assertMinuteWindow(dto.newStartMinute, dto.newEndMinute);

    const day = dayStartUtcFromISO(dto.date);
    const session = await this.getSessionOrThrow(dto);

    const bufferMinutes = dto.bufferMinutes ?? 15;
    await this.assertSessionActiveOrThrow(session, bufferMinutes);
    const oldStart = session.startMinute;
    const oldEnd = session.endMinute;
    const newStart = dto.newStartMinute;
    const newEnd = dto.newEndMinute;

    if (newStart < oldStart || newEnd > oldEnd) {
      throw new BadRequestException('shrinkSession only supports SHRINK. Use expandSession for expanding window.');
    }

    // Store override + update session
    await this.upsertOverride({
      doctorId: session.doctorId,
      clinicId: session.clinicId ?? null,
      date: day,
      meetingType: session.meetingType,
      timeOfDay: session.timeOfDay,
      locationKey: session.locationKey,
      data: {
        isClosed: false,
        startMinute: newStart,
        endMinute: newEnd,
      },
    });

    await this.prisma.availabilitySession.update({
      where: { id: session.id },
      data: { startMinute: newStart, endMinute: newEnd },
    });

    // Protected zone (buffer window)
    const bufferMin = dto.bufferMinutes ?? 15;
    const nowMin = nowUtcMinuteOfDay();
    const protectedUntilMin = Math.min(1440, nowMin + bufferMin);

    // Impacted appointments (keep your existing logic)
    const impacted = await this.prisma.appointment.findMany({
      where: {
        doctorId: session.doctorId,
        status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.CONFIRMED] },
        slot: {
          sessionId: session.id,
          OR: [{ startMinute: { lt: newStart } }, { endMinute: { gt: newEnd } }],
          startMinute: { gt: protectedUntilMin },
        },
      },
      orderBy: { createdAt: 'asc' },
      include: { slot: true },
    });

    const strategy: SchedulingStrategy = (dto.strategy ?? session.strategy) as SchedulingStrategy;

    // Offer expiry window (default 30 mins unless your dto has a value)
    const offerExpiryMinutes = (dto as any).offerExpiryMinutes ?? 30;
    const expiresAt = new Date(Date.now() + offerExpiryMinutes * 60_000);

    const persisted: Array<{
      appointmentId: number;
      offerGroupId: String;
      expiresAt: Date;
      offersCreated: number;
      autoMoveSlotId: number | null;
      
    }> = [];

    for (const appt of impacted) {
      // Strategy-aware candidate selection:
      // STREAM: pick next 3 *empty* slots (bookedCount == 0, AVAILABLE)
      // WAVE: pick next 3 windows with remaining capacity (bookedCount < capacity, not UNAVAILABLE)
      const candidateWhere: any =
        strategy === SchedulingStrategy.WAVE
          ? {
              sessionId: session.id,
              startMinute: { gte: Math.max(protectedUntilMin, newStart) },
              endMinute: { lte: newEnd },
              status: { in: [SlotStatus.AVAILABLE, SlotStatus.FULL] }, // FULL still possible if bookedCount < capacity is false; filter below covers it
              bookedCount: { lt: this.prisma.availabilitySlot.fields?.capacity ?? undefined }, // not usable; keep below via OR-style
            }
          : {
              sessionId: session.id,
              status: SlotStatus.AVAILABLE,
              startMinute: { gte: Math.max(protectedUntilMin, newStart) },
              endMinute: { lte: newEnd },
              bookedCount: 0,
            };

      // Prisma can’t compare bookedCount < capacity directly without raw SQL,
      // so for WAVE we just query by status + window then filter in memory.
      const rawCandidates = await this.prisma.availabilitySlot.findMany({
        where: {
          sessionId: session.id,
          startMinute: { gte: Math.max(protectedUntilMin, newStart) },
          endMinute: { lte: newEnd },
          ...(strategy === SchedulingStrategy.STREAM
            ? { status: SlotStatus.AVAILABLE, bookedCount: 0 }
            : { status: { in: [SlotStatus.AVAILABLE, SlotStatus.FULL] } }),
        },
        orderBy: { startMinute: 'asc' },
        take: 20, // fetch a bit more then filter to 3 for WAVE
        select: {
          id: true,
          startMinute: true,
          endMinute: true,
          capacity: true,
          bookedCount: true,
          status: true,
        },
      });

      const candidates =
        strategy === SchedulingStrategy.WAVE
          ? rawCandidates.filter((s) => s.bookedCount < s.capacity).slice(0, 3)
          : rawCandidates.slice(0, 3);

      if (candidates.length < 3) {
        // SHRINK NOT SAFE per Iteration 2
        throw new BadRequestException(
          `SHRINK NOT SAFE: Not enough ${strategy} slots to re-home appointment ${appt.id}. Doctor must EXPAND session or cancel overflow.`,
        );
      }

      const slotIds = candidates.map((c) => c.id);
      const autoMoveSlotId = slotIds[0];

      const created = await this.rescheduleOffersService.createRescheduleOffers({
        appointmentId: appt.id,
        doctorId: session.doctorId,
        slotIds,
        expiresAt: expiresAt.toISOString(),
        autoMoveSlotId,
      });

      persisted.push({
        appointmentId: appt.id,
        offerGroupId: created.groupId,
        expiresAt: created.expiresAt,
        autoMoveSlotId: created.autoMoveSlotId,
        offersCreated: created.offersCreated,
      });
    }

    return {
      ok: true,
      message: 'Session shrunk. Reschedule offers persisted for impacted appointments.',
      strategy,
      protectedZone: { bufferMinutes: bufferMin, protectedUntilMinute: protectedUntilMin },
      impactedAppointmentIds: impacted.map((a) => a.id),
      expiresAt,
      offerGroups: persisted,
    };
  }

  async updateCapacity(dto: UpdateCapacityDto) {
  if (!Number.isInteger(dto.newCapacityPerSlot) || dto.newCapacityPerSlot < 1) {
    throw new BadRequestException('newCapacityPerSlot must be an integer >= 1');
  }

  const day = dayStartUtcFromISO(dto.date);
  const session = await this.getSessionOrThrow(dto);

  const bufferMinutes = dto.bufferMinutes ?? 15;
  await this.assertSessionActiveOrThrow(session, bufferMinutes);

  const strategy: SchedulingStrategy = (dto.strategy ?? session.strategy) as SchedulingStrategy;

  const bufferMin = dto.bufferMinutes ?? 15;
  const nowMin = nowUtcMinuteOfDay();
  const protectedUntilMin = Math.min(1440, nowMin + bufferMin);

  // Offer expiry (reuse shrink default pattern)
  const offerExpiryMinutes = (dto as any).offerExpiryMinutes ?? 30;
  const expiresAt = new Date(Date.now() + offerExpiryMinutes * 60_000);

  return this.prisma.$transaction(async (tx) => {
    // 1) Store override (authoritative config)
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

    // 2) Update ALL slot capacities for this session
    await tx.availabilitySlot.updateMany({
      where: { sessionId: session.id },
      data: { capacity: dto.newCapacityPerSlot },
    });

    // 3) Normalize slot status/isAvailable based on new capacity
    // FULL if bookedCount >= capacity, else AVAILABLE.
   await tx.availabilitySlot.updateMany({
    where: { sessionId: session.id, bookedCount: { gte: dto.newCapacityPerSlot } },
    data: { status: SlotStatus.FULL },
  });

    await tx.availabilitySlot.updateMany({
      where: { sessionId: session.id, bookedCount: { lt: dto.newCapacityPerSlot } },
      data: { status: SlotStatus.AVAILABLE },
    });


    // 4) Detect overflow slots (bookedCount > new capacity) => displacement required
    const overflowSlots = await tx.availabilitySlot.findMany({
      where: { sessionId: session.id, bookedCount: { gt: dto.newCapacityPerSlot } },
      orderBy: { startMinute: 'asc' },
      select: { id: true, startMinute: true, endMinute: true, bookedCount: true },
    });

    if (!overflowSlots.length) {
      return {
        ok: true,
        message: 'Capacity updated. No overflow detected.',
        strategy,
        newCapacityPerSlot: dto.newCapacityPerSlot,
        protectedZone: { bufferMinutes: bufferMin, protectedUntilMinute: protectedUntilMin },
        impactedAppointmentIds: [],
        expiresAt: null,
        offerGroups: [],
      };
    }

    // If overflow exists inside protected zone, abort (not safe)
    const protectedOverflow = overflowSlots.find((s) => s.startMinute <= protectedUntilMin);
    if (protectedOverflow) {
      throw new BadRequestException(
        `CAPACITY NOT SAFE: overflow exists within protected buffer window (slot ${protectedOverflow.id}). Doctor must EXPAND or cancel overflow.`,
      );
    }

    // 5) Determine impacted appointments to displace:
    // choose overflowCount = bookedCount - newCapacity, and pick that many appointments
    // from that slot (latest booked first) to move.
    const impactedAppointments: Array<{
      id: number;
      slotId: number;
      slot: { id: number; startMinute: number; endMinute: number };
    }> = [];

    for (const slot of overflowSlots) {
      const overflowCount = slot.bookedCount - dto.newCapacityPerSlot;
      if (overflowCount <= 0) continue;

      const toDisplace = await tx.appointment.findMany({
        where: {
          slotId: slot.id,
          status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.CONFIRMED] },
          // hard-freeze statuses are excluded by status filter
        },
        orderBy: { createdAt: 'desc' }, // displace latest booked first
        take: overflowCount,
        include: { slot: true },
      });

      // if we can't fetch enough, something is inconsistent; treat as not safe
      if (toDisplace.length < overflowCount) {
        throw new BadRequestException(
          `CAPACITY NOT SAFE: could not identify enough appointments to displace for slot ${slot.id}.`,
        );
      }

      // forward-only + protected zone enforcement
      for (const appt of toDisplace) {
        if (appt.slot.startMinute <= protectedUntilMin) {
          throw new BadRequestException(
            `CAPACITY NOT SAFE: impacted appointment ${appt.id} is within protected buffer window.`,
          );
        }
        impactedAppointments.push({
          id: appt.id,
          slotId: appt.slotId,
          slot: { id: appt.slot.id, startMinute: appt.slot.startMinute, endMinute: appt.slot.endMinute },
        });
      }
    }

    // 6) For each impacted appointment, find next 3 candidate slots (strategy-aware, forward-only)
    const persisted: {
        appointmentId: number;
        offerGroupId: string;     // ✅ number -> string
        expiresAt: Date;
        autoMoveSlotId: number;
        offersCreated: number;    // ✅ replace offers if service doesn’t return offers[]
      }[] = [];

    for (const appt of impactedAppointments) {
      const minStart = Math.max(appt.slot.startMinute, protectedUntilMin + 1);

      const rawCandidates = await tx.availabilitySlot.findMany({
        where: {
          sessionId: session.id,
          startMinute: { gte: minStart, lte: session.endMinute - 1 },          
          status: { in: [SlotStatus.AVAILABLE, SlotStatus.FULL] },
          ...(strategy === SchedulingStrategy.STREAM ? { bookedCount: 0, status: SlotStatus.AVAILABLE } : {}),
        },
        orderBy: { startMinute: 'asc' },
        take: 25,
        select: { id: true, startMinute: true, endMinute: true, capacity: true, bookedCount: true, status: true },
      });

      const candidates =
        strategy === SchedulingStrategy.WAVE
          ? rawCandidates.filter((s) => s.bookedCount < s.capacity).slice(0, 3)
          : rawCandidates.slice(0, 3);

      if (candidates.length < 3) {
        throw new BadRequestException(
          `CAPACITY NOT SAFE: Not enough ${strategy} slots to re-home appointment ${appt.id}. Doctor must EXPAND session or cancel overflow.`,
        );
      }

      const slotIds = candidates.map((c) => c.id);
      const autoMoveSlotId = slotIds[0];

      const created = await this.rescheduleOffersService.createRescheduleOffers({
        appointmentId: appt.id,
        doctorId: session.doctorId,
        slotIds,
        expiresAt: expiresAt.toISOString(),
        autoMoveSlotId: Number(autoMoveSlotId),
      });

      persisted.push({
      appointmentId: appt.id,
      offerGroupId: created.groupId,          // string ✅
      expiresAt: created.expiresAt,           // or expiresAt (your local Date), depends on what created returns
      autoMoveSlotId: created.autoMoveSlotId,
      offersCreated: created.offersCreated,  
      });
    }

    return {
      ok: true,
      message:
        'Capacity updated. Overflow detected; reschedule offers created for displaced appointments (SHRINK-on-capacity).',
      strategy,
      newCapacityPerSlot: dto.newCapacityPerSlot,
      protectedZone: { bufferMinutes: bufferMin, protectedUntilMinute: protectedUntilMin },
      impactedAppointmentIds: impactedAppointments.map((a) => a.id),
      expiresAt,
      offerGroups: persisted,
    };
  });
}
}