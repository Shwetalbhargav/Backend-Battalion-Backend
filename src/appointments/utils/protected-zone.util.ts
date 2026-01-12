// src/appointments/utils/protected-zone.util.ts
import { BadRequestException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';

/**
 * Protected Zone Rules (authoritative):
 * 1) Hard freeze: appointments with status IN_PROGRESS or COMPLETED are immutable.
 * 2) Buffer freeze: for same-day appointments, anything whose startMinute is within
 *    the next `bufferMinutes` from "now" is immutable.
 *
 * Goal: centralize and enforce "do not move protected appointments" in one place.
 */

export type ProtectedAppointmentInput = {
  status: AppointmentStatus;
  slot: {
    date: Date;        // UTC day start (as stored in DB)
    startMinute: number;
  };
};

export type ProtectedZoneOptions = {
  now?: Date;
  bufferMinutes: number; // e.g. 10–15
};

function utcDayStartFromDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function minutesSinceUtcDayStart(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function isHardFrozenStatus(status: AppointmentStatus): boolean {
  return (
    status === AppointmentStatus.IN_PROGRESS ||
    status === AppointmentStatus.COMPLETED
  );
}

export function getProtectedUntilMinuteUtc(opts: ProtectedZoneOptions): number {
  const now = opts.now ?? new Date();
  return minutesSinceUtcDayStart(now) + opts.bufferMinutes;
}

/**
 * Returns true if the appointment is in protected zone:
 * - IN_PROGRESS / COMPLETED (always protected)
 * - Same-day AND startMinute <= nowMinute + bufferMinutes
 */
export function isProtectedAppointment(
  appt: ProtectedAppointmentInput,
  opts: ProtectedZoneOptions,
): boolean {
  if (isHardFrozenStatus(appt.status)) return true;

  const now = opts.now ?? new Date();
  const todayUtcStart = utcDayStartFromDate(now);

  const isSameDay = appt.slot.date.getTime() === todayUtcStart.getTime();
  if (!isSameDay) return false;

  const protectedUntil = getProtectedUntilMinuteUtc(opts);
  return appt.slot.startMinute <= protectedUntil;
}

/**
 * Throws if appointment is protected, with explicit error reason.
 * Use this before ANY move/reschedule operation.
 */
export function assertAppointmentNotProtected(
  appt: ProtectedAppointmentInput,
  opts: ProtectedZoneOptions,
): void {
  if (isHardFrozenStatus(appt.status)) {
    throw new BadRequestException(
      `Appointment is protected: status ${appt.status} cannot be moved.`,
    );
  }

  const now = opts.now ?? new Date();
  const todayUtcStart = utcDayStartFromDate(now);
  const isSameDay = appt.slot.date.getTime() === todayUtcStart.getTime();

  if (isSameDay) {
    const protectedUntil = getProtectedUntilMinuteUtc(opts);
    if (appt.slot.startMinute <= protectedUntil) {
      throw new BadRequestException(
        `Appointment is protected: it starts within the next ${opts.bufferMinutes} minutes.`,
      );
    }
  }
}
