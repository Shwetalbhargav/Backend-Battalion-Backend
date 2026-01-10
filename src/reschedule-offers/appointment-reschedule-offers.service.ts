// src/reschedule-offers/appointment-reschedule-offers.service.ts

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus, SchedulingStrategy } from '@prisma/client';
import { SlotStatus } from '@prisma/client';

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
type GroupStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

// If your SlotStatus is an enum in Prisma, replace this with the real type.


function isTerminalGroupStatus(s: GroupStatus): boolean {
  return s === 'ACCEPTED' || s === 'DECLINED' || s === 'EXPIRED';
}

function assertForwardOnly(oldStartMinute: number, newStartMinute: number) {
  if (newStartMinute < oldStartMinute) {
    throw new BadRequestException('Forward-only invariant violated');
  }
}

function assertStrategyEligible(
  strategy: SchedulingStrategy,
  slot: { bookedCount: number; capacity: number; status: SlotStatus  },
) {
  if (slot.status !== SlotStatus.AVAILABLE) {
    throw new ConflictException('Slot not available');
  }

  const booked = slot.bookedCount ?? 0;
  const cap = slot.capacity ?? 1;

  if (strategy === SchedulingStrategy.STREAM) {
    if (booked !== 0) throw new ConflictException('STREAM slot already booked');
  } else {
    // WAVE
    if (booked >= cap) throw new ConflictException('WAVE slot at capacity');
  }
}

export interface CreateRescheduleOffersDto {
  appointmentId: number;
  doctorId?: number; 
  slotIds: number[];
  autoMoveSlotId: number;
  expiresAt: string; // ISO
  reason?: string | null;
}

export interface AcceptOfferParams {
  appointmentId: number;
  patientId: number;
  slotId: number;
}

export interface DeclineOfferParams {
  appointmentId: number;
  patientId: number;
}

export interface FindPendingDisplacementGroupsParams {
  sessionId: number;
  limit?: number;
}

export interface AllocateDisplacementsParams {
  sessionId: number;
  doctorId: number;  
  date:Date;
  sessionStartMinute: number;
  sessionEndMinute: number;
  protectedUntilMinute: number; // “buffer zone”
  strategy: SchedulingStrategy;
  limit?: number;
}

@Injectable()
export class AppointmentRescheduleOffersService {
  private readonly logger = new Logger(AppointmentRescheduleOffersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an offer group + individual offers for an impacted appointment.
   * This is your core “SHRINK => create 3 offers + fallback” entry.
   */
  async createRescheduleOffers(dto: CreateRescheduleOffersDto) {
    const expiresAt = new Date(dto.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new BadRequestException('Invalid expiresAt');
    if (!dto.slotIds?.length) throw new BadRequestException('slotIds cannot be empty');

    // warn if fallback not part of offers
    if (!dto.slotIds.includes(dto.autoMoveSlotId)) {
      this.logger.warn(
        `autoMoveSlotId=${dto.autoMoveSlotId} not in slotIds; continuing (fallback may not be visible to patient).`,
      );
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      select: {
        id: true,
        status: true,
        patientId: true,
        slotId: true,
      },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');

    const existingActiveGroup = await this.prisma.appointmentRescheduleOfferGroup.findFirst({
      where: {
        appointmentId: dto.appointmentId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      select: { groupId: true },
    });

    if (existingActiveGroup) {
      throw new ConflictException(
        `Active reschedule offers already exist for appointmentId=${dto.appointmentId}`,
      );
    }

    const groupId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      // expire any “pending but not detected” groups (defensive)
      await tx.appointmentRescheduleOfferGroup.updateMany({
        where: {
          appointmentId: dto.appointmentId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        data: {
          status: 'EXPIRED',
          decidedAt: new Date(),
        },
      });

      const group = await tx.appointmentRescheduleOfferGroup.create({
        data: {
          groupId,
          appointmentId: dto.appointmentId,
          patientId: appointment.patientId,
          doctorId: dto.doctorId,
          reason: dto.reason ?? null,
          autoMoveSlotId: dto.autoMoveSlotId,
          expiresAt,
          status: 'PENDING',
        },
      });

      const slots = await tx.availabilitySlot.findMany({
        where: { id: { in: dto.slotIds } },
        select: { id: true },
      });

      if (slots.length !== dto.slotIds.length) {
        throw new BadRequestException('One or more slotIds do not exist');
      }

      await tx.appointmentRescheduleOffer.createMany({
        data: dto.slotIds.map((slotId) => ({
          groupId: group.groupId,
          appointmentId: dto.appointmentId,
          patientId: appointment.patientId,
          slotId,
          status: 'PENDING' as OfferStatus,
          expiresAt,
        })),
        skipDuplicates: true,
      });

      return {
        groupId: group.groupId,
        appointmentId: dto.appointmentId,
        expiresAt,
        autoMoveSlotId: dto.autoMoveSlotId,
        offersCreated: dto.slotIds.length,
      };
    });
  }

  /**
   * For patient UI: fetch currently pending offers for an appointment.
   * Good for: GET /appointments/:id/reschedule-offers
   */
  async getPendingOffersForAppointment(appointmentId: number, patientId?: number) {
    const now = new Date();

    const group = await this.prisma.appointmentRescheduleOfferGroup.findFirst({
      where: {
        appointmentId,
        status: 'PENDING',
        expiresAt: { gt: now },
        ...(patientId ? { patientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        groupId: true,
        appointmentId: true,
        patientId: true,
        doctorId: true,
        reason: true,
        autoMoveSlotId: true,
        expiresAt: true,
        status: true,
        createdAt: true,
      },
    });

    if (!group) {
      return { appointmentId, active: false, group: null, offers: [] };
    }

    const offers = await this.prisma.appointmentRescheduleOffer.findMany({
      where: {
        groupId: group.groupId,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      orderBy: { slotId: 'asc' },
      select: { id: true, slotId: true, status: true, expiresAt: true },
    });

    return { appointmentId, active: true, group, offers };
  }

  /**
   * Patient accepts a specific offered slot.
   * Good for: POST /appointments/:id/reschedule/accept
   */
  async acceptOffer(params: AcceptOfferParams) {
    const { appointmentId, patientId, slotId } = params;
    const now = new Date();

    const group = await this.prisma.appointmentRescheduleOfferGroup.findFirst({
      where: {
        appointmentId,
        patientId,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      select: { groupId: true, expiresAt: true, autoMoveSlotId: true },
    });

    if (!group) throw new NotFoundException('No active reschedule offer group found');

    const offer = await this.prisma.appointmentRescheduleOffer.findFirst({
      where: {
        groupId: group.groupId,
        appointmentId,
        patientId,
        slotId,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      select: { id: true, slotId: true },
    });

    if (!offer) throw new NotFoundException('Selected offer is not available');

    await this.prisma.$transaction(async (tx) => {
      const freshGroup = await tx.appointmentRescheduleOfferGroup.findUnique({
        where: { groupId: group.groupId },
        select: { status: true, expiresAt: true },
      });

      if (!freshGroup || freshGroup.status !== 'PENDING') {
        throw new ConflictException('Offer group is no longer pending');
      }
      if (new Date(freshGroup.expiresAt) <= now) throw new ConflictException('Offer group has expired');

      const appt = await tx.appointment.update({
        where: { id: appointmentId },
        data: { slotId: slotId },
        include: { slot: true }, 
      });


      if (!appt) throw new NotFoundException('Appointment not found');
      if (appt.patientId !== patientId) throw new ForbiddenException('Not your appointment');

      if (
        appt.status === AppointmentStatus.CANCELLED_BY_DOCTOR ||
        appt.status === AppointmentStatus.CANCELLED_BY_PATIENT
      ) {
        throw new BadRequestException('Appointment is cancelled');
      }

      const newSlot = await tx.availabilitySlot.findUnique({
        where: { id: slotId },
        select: {
          id: true,          
          bookedCount: true,
          capacity: true,
          startMinute: true,
          status: true,
        },
      });

      if (!newSlot) throw new BadRequestException('Slot not found');
      if (newSlot.status !== SlotStatus.AVAILABLE) throw new ConflictException('Slot is no longer available');

      // forward-only (needs appt.slot.startMinute)
      if (appt.slot?.startMinute != null && newSlot.startMinute != null) {
        assertForwardOnly(appt.slot.startMinute, newSlot.startMinute);
      }

      // Reserve in target slot (capacity-safe)
      const reserved = await tx.availabilitySlot.updateMany({
        where: {
          id: slotId,
          status: SlotStatus.AVAILABLE,
          bookedCount: { lt: newSlot.capacity ?? 1 },
        },
        data: { bookedCount: { increment: 1 } },
      });

      if (reserved.count !== 1) throw new ConflictException('Target slot just became full');

      // release old slot seat (best-effort; only if you track bookedCount)
      if (appt.slotId) {
        await tx.availabilitySlot.update({
          where: { id: appt.slotId },
          data: {
            bookedCount: { decrement: 1 },
             status: SlotStatus.AVAILABLE
          },
        });
      }

      // move appointment
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { slotId: slotId },
      });

      // mark offers and group
      await tx.appointmentRescheduleOffer.update({
        where: { id: offer.id },
        data: { status: 'ACCEPTED', decidedAt: now },
      });

      await tx.appointmentRescheduleOffer.updateMany({
        where: { groupId: group.groupId, id: { not: offer.id }, status: 'PENDING' },
        data: { status: 'EXPIRED', decidedAt: now },
      });

      await tx.appointmentRescheduleOfferGroup.update({
        where: { groupId: group.groupId },
        data: {
          status: 'ACCEPTED',
          decidedAt: now,
          decidedSlotId: slotId,
          decisionReason: 'PATIENT_ACCEPTED',
        },
      });
    });

    return { ok: true, appointmentId, movedToSlotId: slotId };
  }

  /**
   * Patient declines the whole offer group.
   * Good for: POST /appointments/:id/reschedule/decline
   */
  async declineOffer(params: DeclineOfferParams) {
    const { appointmentId, patientId } = params;
    const now = new Date();

    const group = await this.prisma.appointmentRescheduleOfferGroup.findFirst({
      where: { appointmentId, patientId, status: 'PENDING' },
      include: { offers: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!group) {
      const resolved = await this.prisma.appointmentRescheduleOfferGroup.findFirst({
        where: {
          appointmentId,
          patientId,
          status: { in: ['ACCEPTED', 'DECLINED', 'EXPIRED'] },
        },
        orderBy: { decidedAt: 'desc' },
      });

      if (resolved) return { ok: true, idempotent: true, message: 'Offer already resolved', appointmentId };
      throw new NotFoundException('No reschedule offer group found');
    }

    if (group.expiresAt <= now) throw new ConflictException('Offer group has expired');
    if (group.status !== 'PENDING') return { ok: true, idempotent: true, message: 'Offer already resolved', appointmentId };

    await this.prisma.$transaction(async (tx) => {
      const freshGroup = await tx.appointmentRescheduleOfferGroup.findUnique({ where: { groupId: group.groupId  } });
      if (!freshGroup) throw new NotFoundException('Offer group not found');
      if (freshGroup.status !== 'PENDING') return;

      if (freshGroup.expiresAt <= now) throw new ConflictException('Offer group has expired');

      await tx.appointmentRescheduleOffer.updateMany({
        where: { groupId: freshGroup.groupId, status: 'PENDING' },
        data: { status: 'DECLINED', decidedAt: now },
      });

      await tx.appointmentRescheduleOfferGroup.update({
        where: { groupId: freshGroup.groupId },
        data: { status: 'DECLINED', decidedAt: now },
      });
    });

    this.logger.log(`Reschedule DECLINED appt=${appointmentId} patient=${patientId} group=${group.groupId}`);
    return { ok: true, appointmentId, offerGroupId: group.groupId };
  }

  /**
   * Worker: auto-move expired pending groups to their fallback slot (autoMoveSlotId).
   * Good for: cron/queue job
   */
  async autoMoveExpiredOffers(limit = 50) {
    const now = new Date();

    const expiredGroups = await this.prisma.appointmentRescheduleOfferGroup.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
      orderBy: { expiresAt: 'asc' },
      take: limit,
      select: { groupId: true, appointmentId: true, autoMoveSlotId: true },
    });

    if (!expiredGroups.length) return { processed: 0, moved: 0 };

    let moved = 0;

    for (const g of expiredGroups) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const fresh = await tx.appointmentRescheduleOfferGroup.findUnique({
            where: { groupId: g.groupId },
            select: { status: true },
          });

          if (!fresh || fresh.status !== 'PENDING') return;

          await tx.appointment.update({
            where: { id: g.appointmentId },
            data: { slotId: g.autoMoveSlotId },
          });

          await tx.appointmentRescheduleOffer.updateMany({
            where: { groupId: g.groupId, status: 'PENDING' },
            data: { status: 'EXPIRED', decidedAt: now },
          });

          await tx.appointmentRescheduleOfferGroup.update({
            where: { groupId: g.groupId },
            data: {
              status: 'EXPIRED',
              decidedAt: now,
              decidedSlotId: g.autoMoveSlotId,
              autoMoved: true,
            },
          });
        });

        moved += 1;
      } catch (e: any) {
        this.logger.error(`Auto-move failed groupId=${g.groupId}, appt=${g.appointmentId}: ${e?.message ?? String(e)}`);
      }
    }

    return { processed: expiredGroups.length, moved };
  }

  /**
   * EXPAND helper: find pending “displacement” groups for appointments in a given session.
   * (This matches your later section but fixed syntax + typed params.)
   */
  async findPendingDisplacementGroupsForSession(params: FindPendingDisplacementGroupsParams) {
    const limit = params.limit ?? 200;

    return this.prisma.appointmentRescheduleOfferGroup.findMany({
      where: {
        status: 'PENDING',
        appointment: {
          slot: { sessionId: params.sessionId },
        },
      },
      orderBy: {
        appointment: { slot: { startMinute: 'asc' } },
      },
      take: limit,
      select: {
        groupId: true,
        appointmentId: true,
        patientId: true,
        expiresAt: true,
        autoMoveSlotId: true,
        appointment: {
          select: {
            id: true,
            status: true,
            
            slot: { select: { id: true, startMinute: true, date: true, sessionId: true } },
          },
        },
      },
    });
  }

  /**
   * EXPAND helper: allocate displaced appointments forward-only into the expanded window.
   * Fixed: awaits loop, removes invalid Prisma filters, capacity-check for WAVE.
   */
  async allocatePendingDisplacementsForSession(params: AllocateDisplacementsParams) {
    const limit = params.limit ?? 200;

    const groups = await this.findPendingDisplacementGroupsForSession({
      sessionId: params.sessionId,
      limit,
    });

    if (!groups.length) return { processed: 0, moved: 0, resolvedWithoutMove: 0 };

    let moved = 0;
    let resolvedWithoutMove = 0;

    for (const g of groups) {
      const appt = g.appointment;
      if (!appt?.slot) continue;

      // never move protected statuses
      if (appt.status === AppointmentStatus.IN_PROGRESS || appt.status === AppointmentStatus.COMPLETED) continue;

      const currentMinute = appt.slot.startMinute;

      const withinExpandedWindow =
        currentMinute >= params.sessionStartMinute && currentMinute <= params.sessionEndMinute - 1;

      const pastProtectedBuffer = currentMinute > params.protectedUntilMinute;

      // if it’s no longer displaced, expire the group as “resolved”
      if (withinExpandedWindow && pastProtectedBuffer) {
        await this.prisma.appointmentRescheduleOfferGroup.update({
          where: { groupId: g.groupId },
          data: { status: 'EXPIRED' },
        });
        await this.prisma.appointmentRescheduleOffer.updateMany({
          where: { groupId: g.groupId },
          data: { status: 'EXPIRED' },
        });
        resolvedWithoutMove++;
        continue;
      }

      const minMinute = Math.max(currentMinute, params.protectedUntilMinute + 1);

      // candidate slots
      const candidates = await this.prisma.availabilitySlot.findMany({
        where: {
          sessionId: params.sessionId,
          startMinute: { gte: minMinute, lte: params.sessionEndMinute - 1 },
          status: SlotStatus.AVAILABLE,
        },
        orderBy: { startMinute: 'asc' },
        take: 50,
        select: { id: true, startMinute: true, bookedCount: true, capacity: true, status: true },
      });

      let chosen = candidates[0];

      if (params.strategy === SchedulingStrategy.STREAM) {
        chosen = candidates.find((s) => (s.bookedCount ?? 0) === 0);
      } else {
        // WAVE capacity rule
        chosen = candidates.find((s) => (s.bookedCount ?? 0) < (s.capacity ?? 1));
      }

      if (!chosen) continue;

      // move + resolve atomically
      await this.prisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: appt.id },
          data: { slotId: chosen!.id },
        });

        await tx.availabilitySlot.update({
          where: { id: chosen!.id },
          data: {
            bookedCount: { increment: 1 },
            ...(params.strategy === SchedulingStrategy.STREAM ? { status: SlotStatus.FULL } : {}),
          },
        });

        await tx.appointmentRescheduleOfferGroup.update({
          where: { groupId: g.groupId },
          data: { status: 'EXPIRED' },
        });

        await tx.appointmentRescheduleOffer.updateMany({
          where: { groupId: g.groupId },
          data: { status: 'EXPIRED' },
        });
      });

      moved++;
    }

    return { processed: groups.length, moved, resolvedWithoutMove };
  }
}
