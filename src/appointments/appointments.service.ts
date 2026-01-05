// src/appointments/appointments.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus, SlotStatus } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /* =====================================================
     PATIENT: BOOK APPOINTMENT
     ===================================================== */
  async bookAppointment(patientId: number, slotId: number, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: slotId },
      });

      if (!slot) {
        throw new NotFoundException('Slot not found');
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
            note,
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
            status:
              newBookedCount >= slot.capacity
                ? SlotStatus.FULL
                : SlotStatus.AVAILABLE,
          },
        });

        return appointment;
      } catch (err) {
        // unique(slotId) safeguard
        if (err.code === 'P2002') {
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
}
