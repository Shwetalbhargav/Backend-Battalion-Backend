// src/appointments/appointments.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus, SlotStatus } from '@prisma/client';


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
          slotId: slot.id,
          doctorId: slot.doctorId,
          patientId,
          note: opts?.note ?? null, // ✅ fixes your "note not in scope" error
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

      const newBookedCount = Math.max(
        0,
        appointment.slot.bookedCount - 1,
      );

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
  async deleteAppointmentByPatient(
    patientId: number,
    appointmentId: number,
  ) {
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
      throw new BadRequestException(
        'Cancel appointment before deleting',
      );
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

      const newBookedCount = Math.max(
        0,
        appointment.slot.bookedCount - 1,
      );

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

}
