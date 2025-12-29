import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

function normalizeToDayStartUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function dayOfWeekUTC(date: Date): DayOfWeek {
  // JS getUTCDay(): 0=Sun..6=Sat
  const map: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return map[date.getUTCDay()];
}

@Injectable()
export class AvailabilitySlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateSlots(doctorId: string, dateFromStr: string, dateToStr: string) {
    const from = normalizeToDayStartUTC(new Date(dateFromStr));
    const to = normalizeToDayStartUTC(new Date(dateToStr));
    if (to < from) throw new BadRequestException('dateTo must be >= dateFrom');

    const rules = await this.prisma.doctorScheduleRule.findMany({
      where: { doctorId, isActive: true },
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
      doctorId: string;
      clinicId: string | null;
      meetingType: any;
      date: Date;
      startMinute: number;
      endMinute: number;
      timeOfDay: any;
      capacity: number;
      bookedCount: number;
      status: any;
    }> = [];

    for (const day of days) {
      const dow = dayOfWeekUTC(day);
      const dayRules = rules.filter((r) => r.dayOfWeek === dow);
      if (dayRules.length === 0) continue;

      const date = normalizeToDayStartUTC(day);

      for (const r of dayRules) {
        const duration = r.slotDurationMin ?? 15;
        for (let start = r.startMinute; start + duration <= r.endMinute; start += duration) {
          slotRows.push({
            doctorId,
            clinicId: r.clinicId ?? null,
            meetingType: r.meetingType,
            date,
            startMinute: start,
            endMinute: start + duration,
            timeOfDay: r.timeOfDay,
            capacity: r.capacityPerSlot ?? 1,
            bookedCount: 0,
            status: 'AVAILABLE',
          });
        }
      }
    }

    if (slotRows.length === 0) return { created: 0, message: 'No slots generated (date range has no matching rule days)' };

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
    if (query.doctorId) where.doctorId = query.doctorId;
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
      orderBy: [{ startMinute: 'asc' }],
    });
  }

  async update(id: string, data: { status?: any; bookedCount?: number }) {
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
