// src/reschedule-offers/appointment-reschedule-offers.service.ts
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateRescheduleOffersDto } from './dto/create-reschedule-offers.dto';

// Adjust this import path if your PrismaService lives elsewhere.
import { PrismaService } from '../prisma/prisma.service';

export type RescheduleOfferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED';

@Injectable()
export class AppointmentRescheduleOffersService {
  private readonly logger = new Logger(AppointmentRescheduleOffersService.name);

  constructor(
    // Keep prisma as `any` so this compiles even if your generated Prisma types differ slightly.
    @Inject(PrismaService) private readonly prisma: any,
  ) {}
  /**
   * Phase 3 internal helper used by SHRINK flow.
   * Keeps older createRescheduleOffers() intact.
   */
  async createOffers(args: {
    appointmentId: number;
    doctorId: number; // maps to createdByDoctorId
    slotIds: number[];
    autoMoveSlotId: number;
    expiresAt: Date;
    reason?: string;
  }) {
    return this.createRescheduleOffers({
      appointmentId: args.appointmentId,
      doctorId: args.doctorId,
      slotIds: args.slotIds,
      autoMoveSlotId: args.autoMoveSlotId,
      expiresAt: args.expiresAt.toISOString(),
      createdByDoctorId: args.doctorId,
      reason: args.reason,
    });
  }

  /**
   * Create an offer group + individual offers for an impacted appointment.
   * Intended to be called by SHRINK flow (internal), not necessarily exposed as public API.
   */
  async createRescheduleOffers(dto: CreateRescheduleOffersDto) {
    const expiresAt = new Date(dto.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiresAt');
    }
    if (!dto.slotIds?.length) {
      throw new BadRequestException('slotIds cannot be empty');
    }
    if (!dto.slotIds.includes(dto.autoMoveSlotId)) {
      // Not strictly required, but avoids confusion. Your plan says fallback = earliest offered slot.
      this.logger.warn(
        `autoMoveSlotId=${dto.autoMoveSlotId} is not included in slotIds; continuing anyway.`,
      );
    }

    // Basic existence checks
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      select: {
        id: true,
        status: true,
        patientId: true,
        availabilitySlotId: true,
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    // Prevent stacking multiple active offer groups for the same appointment
    const existingActiveGroup =
      await this.prisma.appointmentRescheduleOfferGroup.findFirst({
        where: {
          appointmentId: dto.appointmentId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        select: { id: true, groupId: true },
      });
    if (existingActiveGroup) {
      throw new ConflictException(
        `Active reschedule offers already exist for appointmentId=${dto.appointmentId}`,
      );
    }

    const groupId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.appointmentRescheduleOfferGroup.create({
        data: {
          groupId,
          appointmentId: dto.appointmentId,
          patientId: appointment.patientId,
          createdByDoctorId: dto.createdByDoctorId,
          reason: dto.reason ?? null,
          autoMoveSlotId: dto.autoMoveSlotId,
          expiresAt,
          status: 'PENDING',
        },
      });

      // Optionally validate slots exist (safe check)
      const slots = await tx.availabilitySlot.findMany({
        where: { id: { in: dto.slotIds } },
        select: { id: true, startTime: true, endTime: true, isAvailable: true },
      });
      if (slots.length !== dto.slotIds.length) {
        throw new BadRequestException('One or more slotIds do not exist');
      }

      // Create offers
      await tx.appointmentRescheduleOffer.createMany({
        data: dto.slotIds.map((slotId) => ({
          groupId: group.groupId,
          appointmentId: dto.appointmentId,
          patientId: appointment.patientId,
          slotId,
          status: 'PENDING',
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
   * (Your appointments controller can call this in GET /appointments/:id/reschedule-offers)
   */
  async getPendingOffersForAppointment(
    appointmentId: number,
    patientId?: number,
  ) {
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
        createdByDoctorId: true,
        reason: true,
        autoMoveSlotId: true,
        expiresAt: true,
        status: true,
        createdAt: true,
      },
    });

    if (!group) {
      return {
        appointmentId,
        active: false,
        group: null,
        offers: [],
      };
    }

    const offers = await this.prisma.appointmentRescheduleOffer.findMany({
      where: {
        groupId: group.groupId,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      orderBy: { slotId: 'asc' },
      select: {
        id: true,
        slotId: true,
        status: true,
        expiresAt: true,
      },
    });

    return {
      appointmentId,
      active: true,
      group,
      offers,
    };
  }

  /**
   * Patient accepts a specific slot offer.
   * (Your appointments controller can call this from POST /appointments/:id/reschedule/accept)
   */
  async acceptOffer(params: {
    appointmentId: number;
    patientId: number;
    slotId: number;
  }) {
    const { appointmentId, patientId, slotId } = params;
    const now = new Date();

    // Load active group
    const group = await this.prisma.appointmentRescheduleOfferGroup.findFirst({
      where: {
        appointmentId,
        patientId,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      select: {
        groupId: true,
        expiresAt: true,
        autoMoveSlotId: true,
      },
    });

    if (!group)
      throw new NotFoundException('No active reschedule offer group found');

    // Ensure offer exists & pending
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

    return this.prisma.$transaction(async (tx) => {
      // Lock-like check: ensure group still pending
      const freshGroup = await tx.appointmentRescheduleOfferGroup.findUnique({
        where: { groupId: group.groupId },
        select: { status: true, expiresAt: true },
      });
      if (!freshGroup || freshGroup.status !== 'PENDING') {
        throw new ConflictException('Offer group is no longer pending');
      }
      if (new Date(freshGroup.expiresAt) <= now) {
        throw new ConflictException('Offer group has expired');
      }

      // Validate slot availability (minimal check; your real logic may check WAVE capacity)
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: slotId },
        select: { id: true, isAvailable: true },
      });
      if (!slot) throw new BadRequestException('Slot not found');
      if (slot.isAvailable === false) {
        throw new ConflictException('Slot is no longer available');
      }

      // Move appointment to chosen slot
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          availabilitySlotId: slotId,
          // Optional fields you might have:
          // rescheduledAt: now,
          // updatedAt: now,
        },
      });

      // Mark accepted offer & finalize group
      await tx.appointmentRescheduleOffer.update({
        where: { id: offer.id },
        data: { status: 'ACCEPTED', decidedAt: now },
      });

      await tx.appointmentRescheduleOffer.updateMany({
        where: {
          groupId: group.groupId,
          id: { not: offer.id },
          status: 'PENDING',
        },
        data: { status: 'DECLINED', decidedAt: now },
      });

      await tx.appointmentRescheduleOfferGroup.update({
        where: { groupId: group.groupId },
        data: { status: 'ACCEPTED', decidedAt: now, decidedSlotId: slotId },
      });

      return {
        appointmentId,
        movedToSlotId: slotId,
        groupId: group.groupId,
        appointment: updatedAppointment,
      };
    });
  }

  /**
   * Worker entry: auto-move any expired pending groups to their fallback slot.
   * Forward-only policy & detailed constraints should be enforced in your slot selection layer.
   * Here we simply apply the precomputed fallback.
   */
  async autoMoveExpiredOffers(limit = 50) {
    const now = new Date();

    const expiredGroups =
      await this.prisma.appointmentRescheduleOfferGroup.findMany({
        where: {
          status: 'PENDING',
          expiresAt: { lte: now },
        },
        orderBy: { expiresAt: 'asc' },
        take: limit,
        select: {
          groupId: true,
          appointmentId: true,
          patientId: true,
          autoMoveSlotId: true,
          expiresAt: true,
        },
      });

    if (!expiredGroups.length) return { processed: 0, moved: 0 };

    let moved = 0;

    for (const group of expiredGroups) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Re-check in transaction
          const fresh = await tx.appointmentRescheduleOfferGroup.findUnique({
            where: { groupId: group.groupId },
            select: { status: true },
          });
          if (!fresh || fresh.status !== 'PENDING') return;

          // Move appointment to fallback slot
          await tx.appointment.update({
            where: { id: group.appointmentId },
            data: {
              availabilitySlotId: group.autoMoveSlotId,
              // rescheduledAt: now,
            },
          });

          // Mark offers + group
          await tx.appointmentRescheduleOffer.updateMany({
            where: { groupId: group.groupId, status: 'PENDING' },
            data: { status: 'EXPIRED', decidedAt: now },
          });

          await tx.appointmentRescheduleOfferGroup.update({
            where: { groupId: group.groupId },
            data: {
              status: 'EXPIRED',
              decidedAt: now,
              decidedSlotId: group.autoMoveSlotId,
              autoMoved: true,
            },
          });
        });

        moved += 1;
      } catch (e: any) {
        // Don’t crash the worker loop; just log & continue
        this.logger.error(
          `Auto-move failed for groupId=${group.groupId}, appointmentId=${group.appointmentId}: ${e?.message ?? e}`,
        );
      }
    }

    return { processed: expiredGroups.length, moved };
  }
}
