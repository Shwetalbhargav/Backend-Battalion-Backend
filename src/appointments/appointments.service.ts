// src/appointments/appointments.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RescheduleOfferStatus,  
  SlotStatus,
  AppointmentStatus,Role,
} from '@prisma/client';

import { assertAppointmentNotProtected } from './utils/protected-zone.util';



const MIN_SHIFT = 10;
const MAX_SHIFT = 180;

function validateShift(shiftMinutes: number) {
  const abs = Math.abs(shiftMinutes);
  if (abs < MIN_SHIFT || abs > MAX_SHIFT) {
    throw new Error('Shift minutes must be between 10 and 180');
  }
}

function isSlotOver(slotDate: Date, startMinute: number): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (slotDate < today) return true;
  if (slotDate > today) return false;

  const nowMinute = now.getHours() * 60 + now.getMinutes();
  return startMinute <= nowMinute;
}


@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}
  private assertMovableOrThrow(appt: { status: AppointmentStatus; slot: { date: Date; startMinute: number } }) {
  assertAppointmentNotProtected(
    { status: appt.status, slot: appt.slot },
    { bufferMinutes: 15 }, // config later
  );
}

private async normalizeSlotState(slotId: number) {
  const slot = await this.prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    select: { id: true, bookedCount: true, capacity: true },
  });

  if (!slot) throw new NotFoundException('Slot not found');

  const isFull = slot.bookedCount >= slot.capacity;

  await this.prisma.availabilitySlot.update({
    where: { id: slotId },
    data: {
      status: isFull ? SlotStatus.FULL : SlotStatus.AVAILABLE,
    },
  });

  return { slotId, status: isFull ? SlotStatus.FULL : SlotStatus.AVAILABLE };
}


  

  /* =====================================================
     PATIENT: BOOK APPOINTMENT
     ===================================================== */
  async bookAppointment(
  patientId: number,
  slotId: number,
  opts?: {
    allowFutureDayBooking?: boolean;
    autoBookNextAvailableDayIfOver?: boolean;
    note?: string; // ✅ optional note
  },
) {
  const allowFutureDayBooking = opts?.allowFutureDayBooking ?? true;
  const autoNextDay = opts?.autoBookNextAvailableDayIfOver ?? true;

  return this.prisma.$transaction(async (tx) => {
    const slot = await tx.availabilitySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) throw new Error('Slot not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!allowFutureDayBooking && slot.date > today) {
      throw new Error('Future-day booking is disabled');
    }

    if (isSlotOver(slot.date, slot.startMinute)) {
      if (!autoNextDay) throw new Error('Slot is over');

      const nextSlot = await tx.availabilitySlot.findFirst({
        where: {
          doctorId: slot.doctorId,
          meetingType: slot.meetingType,
          locationKey: slot.locationKey,
          date: { gt: slot.date },
          status: SlotStatus.AVAILABLE,
          bookedCount: { lt: slot.capacity },
        },
        orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
      });

      if (!nextSlot) throw new Error('No future slots available');
      if (!allowFutureDayBooking) throw new Error('Future-day booking is disabled');

      // start a fresh booking for the next slot
      return this.bookAppointment(patientId, nextSlot.id, opts);
    }

    if (slot.status !== SlotStatus.AVAILABLE) {
      throw new BadRequestException('Slot not available');
    }

    if (slot.bookedCount >= slot.capacity) {
      throw new BadRequestException('Slot is already full');
    }

    try {
      const appointment = await tx.appointment.create({
        data: {
          status: AppointmentStatus.BOOKED,
          note: opts?.note ?? null,
          slot: { connect: { id: slot.id } },
          doctor: { connect: { id: slot.doctorId } },
          patient: { connect: { id: patientId } }, 
        },
        include: {
          slot: true,
          doctor: true,
        },
      });

      const newBookedCount = slot.bookedCount + 1;

      await tx.availabilitySlot.update({
        where: { id: slot.id },
        data: {
          bookedCount: newBookedCount,
          status: newBookedCount >= slot.capacity ? SlotStatus.FULL : SlotStatus.AVAILABLE,
        },
      });

      return appointment;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestException('Slot already booked');
      }
      throw err;
    }
  });
}

  /* =====================================================
     PATIENT: VIEW MY APPOINTMENTS
     ===================================================== */
  async getMyAppointments(patientId: number) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        slot: true,
        doctor: {
          include: { user: true },
        },
      },
    });
  }

  /* =====================================================
     PATIENT: CANCEL APPOINTMENT
     ===================================================== */
  async cancelAppointmentByPatient(
    patientId: number,
    appointmentId: number,
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { slot: true },
      });

      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }

      if (appointment.patientId !== patientId) {
        throw new ForbiddenException('You cannot cancel this appointment');
      }

      if (
        appointment.status === AppointmentStatus.CANCELLED_BY_PATIENT ||
        appointment.status === AppointmentStatus.CANCELLED_BY_DOCTOR
      ) {
        throw new BadRequestException('Appointment already cancelled');
      }

      const newBookedCount = Math.max(0, appointment.slot.bookedCount - 1);

      await tx.availabilitySlot.update({
        where: { id: appointment.slotId },
        data: {
          bookedCount: newBookedCount,
          status: SlotStatus.AVAILABLE,
        },
      });

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED_BY_PATIENT,
          cancelReason: reason,
          cancelledAt: new Date(),
        },
      });
    });
  }

  /* =====================================================
     PATIENT: DELETE APPOINTMENT (ONLY IF CANCELLED)
     ===================================================== */
  async deleteAppointmentByPatient(patientId: number, appointmentId: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.patientId !== patientId) {
      throw new ForbiddenException('You cannot delete this appointment');
    }

    if (
      appointment.status !== AppointmentStatus.CANCELLED_BY_PATIENT &&
      appointment.status !== AppointmentStatus.CANCELLED_BY_DOCTOR
    ) {
      throw new BadRequestException('Cancel appointment before deleting');
    }

    await this.prisma.appointment.delete({
      where: { id: appointmentId },
    });

    return { deleted: true };
  }

  /* =====================================================
     DOCTOR: VIEW MY APPOINTMENTS
     ===================================================== */
  async getDoctorAppointments(doctorId: number) {
    return this.prisma.appointment.findMany({
      where: { doctorId },
      orderBy: { createdAt: 'desc' },
      include: {
        slot: true,
        patient: {
          include: { user: true },
        },
      },
    });
  }

  /* =====================================================
     DOCTOR: CONFIRM APPOINTMENT
     ===================================================== */
  async confirmAppointment(doctorId: number, appointmentId: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException('Not your appointment');
    }

    if (appointment.status !== AppointmentStatus.BOOKED) {
      throw new BadRequestException('Appointment cannot be confirmed');
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });
  }

  /* =====================================================
     DOCTOR: CANCEL APPOINTMENT
     ===================================================== */
  async cancelAppointmentByDoctor(
    doctorId: number,
    appointmentId: number,
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { slot: true },
      });

      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }

      if (appointment.doctorId !== doctorId) {
        throw new ForbiddenException('Not your appointment');
      }

      if (
        appointment.status === AppointmentStatus.CANCELLED_BY_DOCTOR ||
        appointment.status === AppointmentStatus.CANCELLED_BY_PATIENT
      ) {
        throw new BadRequestException('Appointment already cancelled');
      }

      const newBookedCount = Math.max(0, appointment.slot.bookedCount - 1);

      await tx.availabilitySlot.update({
        where: { id: appointment.slotId },
        data: {
          bookedCount: newBookedCount,
          status: SlotStatus.AVAILABLE,
        },
      });

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED_BY_DOCTOR,
          cancelReason: reason,
          cancelledAt: new Date(),
        },
      });
    });
  }


/* =====================================================
    Doctor reschedule — ALL future appointments
     ===================================================== */

     async rescheduleAllFutureAppointments(
  doctorId: number,
  shiftMinutes: number,
) {
  validateShift(shiftMinutes);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const appointments = await this.prisma.appointment.findMany({
    where: {
      doctorId,
      status: {
        in: ['BOOKED', 'CONFIRMED'],
      },
      slot: {
        date: {
          gte: today,
        },
      },
    },
    include: {
      slot: true,
    },
  });

  for (const appt of appointments) {
    if (isSlotOver(appt.slot.date, appt.slot.startMinute)) continue;

    const baseStart =
      appt.overrideStartMinute ?? appt.slot.startMinute;
    const baseEnd =
      appt.overrideEndMinute ?? appt.slot.endMinute;
    const baseDate =
      appt.overrideDate ?? appt.slot.date;

    await this.prisma.appointment.update({
      where: { id: appt.id },
      data: {
        overrideDate: baseDate,
        overrideStartMinute: baseStart + shiftMinutes,
        overrideEndMinute: baseEnd + shiftMinutes,
      },
    });
  }

  return { success: true };
}

/* =====================================================
    Doctor reschedule — SELECTED appointments
     ===================================================== */

     async rescheduleSelectedAppointments(
  doctorId: number,
  appointmentIds: number[],
  shiftMinutes: number,
) {
  validateShift(shiftMinutes);

  const appointments = await this.prisma.appointment.findMany({
    where: {
      id: { in: appointmentIds },
      doctorId,
      status: {
        in: ['BOOKED', 'CONFIRMED'],
      },
    },
    include: {
      slot: true,
    },
  });

  for (const appt of appointments) {
    if (isSlotOver(appt.slot.date, appt.slot.startMinute)) continue;

    const baseStart =
      appt.overrideStartMinute ?? appt.slot.startMinute;
    const baseEnd =
      appt.overrideEndMinute ?? appt.slot.endMinute;
    const baseDate =
      appt.overrideDate ?? appt.slot.date;

    await this.prisma.appointment.update({
      where: { id: appt.id },
      data: {
        overrideDate: baseDate,
        overrideStartMinute: baseStart + shiftMinutes,
        overrideEndMinute: baseEnd + shiftMinutes,
      },
    });
  }

  return { success: true };
}


  /**
   * GET /appointments/:id/reschedule-offers
   * - reads from offers tables
   * - ensures appointment belongs to patient OR doctor owns appointment
   */
  async getRescheduleOffersForAppointment(args: { userId: number; role: Role; appointmentId: number }) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: args.appointmentId },
      select: { id: true, doctorId: true, patientId: true },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    if (args.role === Role.PATIENT && appt.patientId !== args.userId) {
      throw new ForbiddenException('You cannot view offers for this appointment');
    }
    if (args.role === Role.DOCTOR && appt.doctorId !== args.userId) {
      throw new ForbiddenException('You cannot view offers for this appointment');
    }

    const now = new Date();

    const group = await this.prisma.appointmentRescheduleOfferGroup.findFirst({
      where: {
        appointmentId: appt.id,
        status: RescheduleOfferStatus.PENDING,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        offers: {
          orderBy: { createdAt: 'asc' },
          include: {
            slot: {
              select: {
                id: true,
                date: true,
                startMinute: true,
                endMinute: true,
                status: true,
                capacity: true,
                bookedCount: true,
              },
            },
          },
        },
      },
    });

    return {
      appointmentId: appt.id,
      active: !!group,
      group,
      autoMoveSlotId: group?.autoMoveSlotId ?? null,
      expiresAt: group?.expiresAt ?? null,
    };
  }

  /**
   * POST /appointments/:id/reschedule/accept {slotId}
   * Validate offer is active + belongs to appt + not expired
   * transaction:
   *  - reserve capacity in new slot
   *  - decrement old slot seat
   *  - move appointment
   *  - mark offer ACCEPTED, cancel siblings, group accepted
   */
  async acceptRescheduleOffer(args: { patientId: number; appointmentId: number; slotId: number }) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id: args.appointmentId },
        include: { slot: true },
      });
      if (!appt) throw new NotFoundException('Appointment not found');
      if (appt.patientId !== args.patientId) throw new ForbiddenException('Not your appointment');
       
      // ✅ PROTECTED ZONE ENFORCEMENT
          assertAppointmentNotProtected(
            { status: appt.status, slot: { date: appt.slot.date, startMinute: appt.slot.startMinute } },
            { bufferMinutes: 15 },
          );
      if (
        appt.status === AppointmentStatus.CANCELLED_BY_DOCTOR ||
        appt.status === AppointmentStatus.CANCELLED_BY_PATIENT
      ) {
        throw new BadRequestException('Appointment is cancelled');
      }

      const group = await tx.appointmentRescheduleOfferGroup.findFirst({
        where: {
          appointmentId: appt.id,
          status: RescheduleOfferStatus.PENDING,
          expiresAt: { gt: now },
        },
        include: { offers: true },
      });
      if (!group) throw new NotFoundException('No active reschedule offer group');

      const offer = await tx.appointmentRescheduleOffer.findFirst({
        where: {
          groupId: group.groupId,
          slotId: args.slotId,
          status: RescheduleOfferStatus.PENDING,
        },
      });
      if (!offer) throw new NotFoundException('Selected offer is not active for this appointment');

      if (appt.slotId === args.slotId) {
        throw new BadRequestException('Appointment is already on that slot');
      }

      // Reserve seat in new slot (race-safe)
      const newSlot = await tx.availabilitySlot.findUnique({ where: { id: args.slotId } });
      if (!newSlot) throw new NotFoundException('Target slot not found');

      if (newSlot.bookedCount >= newSlot.capacity) {
        throw new ConflictException('Target slot is full');
      }

      const reserved = await tx.availabilitySlot.updateMany({
        where: {
          id: args.slotId,
          status: { in: [SlotStatus.AVAILABLE, SlotStatus.FULL] },
          bookedCount: { lt: newSlot.capacity },
        },
        data: { bookedCount: { increment: 1 } },
      });
      if (reserved.count !== 1) {
        throw new ConflictException('Target slot just became full');
      }

      // Decrement old slot seat
      await tx.availabilitySlot.update({
        where: { id: appt.slotId },
        data: {
          bookedCount: { decrement: 1 },
          status: SlotStatus.AVAILABLE,
        },
      });

      // Move appointment
      const updatedAppointment = await tx.appointment.update({
        where: { id: appt.id },
        data: { slotId: args.slotId },
      });

      // Update new slot FULL if we reached capacity
      const updatedNewSlot = await tx.availabilitySlot.findUnique({ where: { id: args.slotId } });
      if (updatedNewSlot && updatedNewSlot.bookedCount >= updatedNewSlot.capacity) {
        await tx.availabilitySlot.update({
          where: { id: args.slotId },
          data: { status: SlotStatus.FULL },
        });
      }

      // Mark offer accepted + siblings cancelled, group accepted
      await tx.appointmentRescheduleOffer.update({
        where: { id: offer.id },
        data: { status: RescheduleOfferStatus.ACCEPTED },
      });

      await tx.appointmentRescheduleOffer.updateMany({
        where: {
          groupId: group.groupId,
          id: { not: offer.id },
          status: RescheduleOfferStatus.PENDING,
        },
        data: { status: RescheduleOfferStatus.DECLINED },
      });

      
      return {
        ok: true,
        appointmentId: appt.id,
        movedToSlotId: args.slotId,
        offerGroupId: group.groupId,
        appointment: updatedAppointment,
      };
    });
  }
}


  




