import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type SchedulingStrategy = 'STREAM' | 'WAVE';

function normalizeToDayStartUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function dayOfWeekUTC(date: Date): DayOfWeek {
  // JS getUTCDay(): 0=Sun..6=Sat
  const map: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return map[date.getUTCDay()];
}

function addMinutesToDate(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Expected wavePattern format (recommended):
 * [
 *   { offsetMin: 0,  capacity: 3, durationMin?: 15 },
 *   { offsetMin: 15, capacity: 1 },
 *   { offsetMin: 30, capacity: 1 }
 * ]
 */
function parseWavePattern(pattern: any): Array<{ offsetMin: number; capacity: number; durationMin?: number }> | null {
  if (!pattern) return null;

  // In case someone stores { pattern: [...] }
  const maybe = Array.isArray(pattern) ? pattern : Array.isArray(pattern?.pattern) ? pattern.pattern : null;
  if (!maybe) return null;

  const out: Array<{ offsetMin: number; capacity: number; durationMin?: number }> = [];
  for (const item of maybe) {
    const offsetMin = Number(item?.offsetMin);
    const capacity = Number(item?.capacity);
    const durationMin = item?.durationMin !== undefined ? Number(item.durationMin) : undefined;

    if (!Number.isFinite(offsetMin) || offsetMin < 0) continue;
    if (!Number.isFinite(capacity) || capacity < 1) continue;
    if (durationMin !== undefined && (!Number.isFinite(durationMin) || durationMin < 1)) continue;

    out.push({ offsetMin, capacity, durationMin });
  }

  return out.length ? out : null;
}

@Injectable()
export class AvailabilitySlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateSlots(doctorId: string, dateFromStr: string, dateToStr: string) {
    const from = normalizeToDayStartUTC(new Date(dateFromStr));
    const to = normalizeToDayStartUTC(new Date(dateToStr));
    if (to < from) throw new BadRequestException('dateTo must be >= dateFrom');

    const rules = await this.prisma.doctorScheduleRule.findMany({
      where: { doctorId: doctorId as any, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });

    if (rules.length === 0) {
      throw new BadRequestException('No active schedule rules found for this doctor');
    }

    const days: Date[] = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
      days.push(new Date(d));
    }

    const slotRows: Array<{
      doctorId: any;
      clinicId: any;
      meetingType: any;
      date: Date;
      startMinute: number;
      endMinute: number;
      timeOfDay: any;
      startAt: Date;
      endAt: Date;
      capacity: number;
      bookedCount: number;
      status: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE';
    }> = [];

    for (const day of days) {
      const dow = dayOfWeekUTC(day);
      const dayRules = rules.filter((r) => r.dayOfWeek === dow);
      if (dayRules.length === 0) continue;

      const date = normalizeToDayStartUTC(day);

      for (const r of dayRules) {
        const strategy: SchedulingStrategy = (r as any).strategy ?? 'STREAM';

        // ---- STREAM (existing behavior) ----
        if (strategy === 'STREAM') {
          const duration = r.slotDurationMin ?? 15;
          for (let start = r.startMinute; start + duration <= r.endMinute; start += duration) {
            const startAt = addMinutesToDate(date, start);
            const endAt = addMinutesToDate(date, start + duration);

            slotRows.push({
              doctorId: doctorId as any,
              clinicId: r.clinicId ?? null,
              meetingType: r.meetingType,
              date,
              startMinute: start,
              endMinute: start + duration,
              timeOfDay: r.timeOfDay,
              startAt,
              endAt,
              capacity: r.capacityPerSlot ?? 1,
              bookedCount: 0,
              status: 'AVAILABLE',
            });
          }
          continue;
        }

        // ---- WAVE ----
        const wavePattern = parseWavePattern((r as any).wavePattern);
        const baseDuration = r.slotDurationMin ?? 15;

        // cadence: waveEveryMin preferred; fallback to 60
        const waveEveryMin: number = Number((r as any).waveEveryMin ?? 60);
        if (!Number.isFinite(waveEveryMin) || waveEveryMin < 1) {
          throw new BadRequestException('Invalid waveEveryMin on schedule rule');
        }

        // SIMPLE WAVE: one block per wave interval with waveCapacity
        if (!wavePattern) {
          const waveCapacity: number = Number((r as any).waveCapacity ?? (r.capacityPerSlot ?? 1));
          if (!Number.isFinite(waveCapacity) || waveCapacity < 1) {
            throw new BadRequestException('Invalid waveCapacity on schedule rule');
          }

          for (
            let start = r.startMinute;
            start + waveEveryMin <= r.endMinute;
            start += waveEveryMin
          ) {
            const startAt = addMinutesToDate(date, start);
            const endAt = addMinutesToDate(date, start + waveEveryMin);

            slotRows.push({
              doctorId: doctorId as any,
              clinicId: r.clinicId ?? null,
              meetingType: r.meetingType,
              date,
              startMinute: start,
              endMinute: start + waveEveryMin,
              timeOfDay: r.timeOfDay,
              startAt,
              endAt,
              capacity: waveCapacity,
              bookedCount: 0,
              status: 'AVAILABLE',
            });
          }

          continue;
        }

        // PATTERN WAVE: repeat pattern every waveEveryMin (or fallback)
        for (
          let base = r.startMinute;
          base < r.endMinute;
          base += waveEveryMin
        ) {
          for (const p of wavePattern) {
            const start = base + p.offsetMin;
            const duration = p.durationMin ?? baseDuration;

            // ensure inside rule window
            if (start < r.startMinute) continue;
            if (start + duration > r.endMinute) continue;

            const startAt = addMinutesToDate(date, start);
            const endAt = addMinutesToDate(date, start + duration);

            slotRows.push({
              doctorId: doctorId as any,
              clinicId: r.clinicId ?? null,
              meetingType: r.meetingType,
              date,
              startMinute: start,
              endMinute: start + duration,
              timeOfDay: r.timeOfDay,
              startAt,
              endAt,
              capacity: p.capacity,
              bookedCount: 0,
              status: 'AVAILABLE',
            });
          }
        }
      }
    }

    // Create many slots; skip duplicates so you can regenerate safely
    const result = await this.prisma.availabilitySlot.createMany({
      data: slotRows,
      skipDuplicates: true,
    });

    return { created: result.count };
  }

  async search(query: {
    doctorId?: string;
    date?: string; // YYYY-MM-DD
    meetingType?: 'ONLINE' | 'OFFLINE';
    timeOfDay?: 'MORNING' | 'EVENING';
    status?: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE';
  }) {
    const where: any = {};
    if (query.doctorId) where.doctorId = query.doctorId as any;
    if (query.meetingType) where.meetingType = query.meetingType;
    if (query.timeOfDay) where.timeOfDay = query.timeOfDay;
    if (query.status) where.status = query.status;

    if (query.date) {
      const date = normalizeToDayStartUTC(new Date(query.date));
      where.date = date;
    }

    return this.prisma.availabilitySlot.findMany({
      where,
      include: {
        clinic: true,
        doctor: {
          include: {
            specialties: { include: { specialty: true } },
            services: { include: { service: true } },
          },
        },
      },
      orderBy: [{ startAt: 'asc' }],
    });
  }

  async updateSlot(id: number, data: { status?: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE'; bookedCount?: number }) {
    const existing = await this.prisma.availabilitySlot.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Slot not found');

    const updated = await this.prisma.availabilitySlot.update({
      where: { id },
      data,
    });

    // auto FULL if bookedCount reaches capacity (only if not UNAVAILABLE)
    if (updated.status !== 'UNAVAILABLE' && updated.bookedCount >= updated.capacity) {
      return this.prisma.availabilitySlot.update({
        where: { id },
        data: { status: 'FULL' },
      });
    }

    return updated;
  }
}
