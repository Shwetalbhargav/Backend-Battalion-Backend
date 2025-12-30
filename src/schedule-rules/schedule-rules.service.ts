import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';

type Day = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type MeetingType = 'ONLINE' | 'OFFLINE';
type TimeOfDay = 'MORNING' | 'EVENING';

@Injectable()
export class ScheduleRulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * TS NOTE:
   * If Prisma Client types are not refreshed yet, TS will say:
   * "Property 'doctorScheduleRule' does not exist on type PrismaService"
   * Using `as any` removes the TS error immediately.
   *
   * Still make sure you run:
   *   npx prisma generate
   * and restart TS server.
   */
  private get db() {
    return this.prisma as any;
  }

  private validateWindow(start: number, end: number) {
    if (end <= start) throw new BadRequestException('endMinute must be greater than startMinute');
    if (start < 0 || end > 1440) throw new BadRequestException('Minutes must be between 0 and 1440');
  }

  async create(dto: CreateScheduleRuleDto) {
    this.validateWindow(dto.startMinute, dto.endMinute);

    // Int schema: doctorId/clinicId are numbers
    const doctorId = Number(dto.doctorId);
    if (Number.isNaN(doctorId)) throw new BadRequestException('doctorId must be a number');

    const clinicId = dto.clinicId !== undefined && dto.clinicId !== null ? Number(dto.clinicId) : null;
    if (dto.meetingType === 'OFFLINE' && !clinicId) {
      throw new BadRequestException('clinicId is required for OFFLINE schedule rule');
    }

    return this.db.doctorScheduleRule.create({
      data: {
        doctorId,
        clinicId,
        meetingType: dto.meetingType,
        dayOfWeek: dto.dayOfWeek,
        timeOfDay: dto.timeOfDay,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        slotDurationMin: dto.slotDurationMin ?? 15,
        capacityPerSlot: dto.capacityPerSlot ?? 1,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(doctorId?: string) {
    const where = doctorId ? { doctorId: Number(doctorId) } : undefined;
    if (doctorId && Number.isNaN(where.doctorId)) {
      throw new BadRequestException('doctorId must be a number');
    }

    return this.db.doctorScheduleRule.findMany({
      where,
      orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
  }

  /**
   * Bulk defaults:
   * Mon–Fri: Morning 10–13, Evening 18–22
   * Sat: Morning 9–11:30
   * For BOTH meeting types ONLINE and OFFLINE
   */
  async bulkCreateDefaults(doctorIdRaw: string | number, clinicIdRaw?: string | number) {
    const doctorId = Number(doctorIdRaw);
    if (Number.isNaN(doctorId)) throw new BadRequestException('doctorId must be a number');

    const clinicId = clinicIdRaw !== undefined ? Number(clinicIdRaw) : undefined;
    if (clinicIdRaw !== undefined && Number.isNaN(clinicId)) {
      throw new BadRequestException('clinicId must be a number');
    }

    const weekdays: Day[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const meetingTypes: MeetingType[] = ['ONLINE', 'OFFLINE'];

    const templates: Array<{
      dayOfWeek: Day;
      timeOfDay: TimeOfDay;
      startMinute: number;
      endMinute: number;
    }> = [
      ...weekdays.map((d) => ({ dayOfWeek: d, timeOfDay: 'MORNING' as const, startMinute: 600, endMinute: 780 })), // 10:00-13:00
      ...weekdays.map((d) => ({ dayOfWeek: d, timeOfDay: 'EVENING' as const, startMinute: 1080, endMinute: 1320 })), // 18:00-22:00
      { dayOfWeek: 'SAT', timeOfDay: 'MORNING', startMinute: 540, endMinute: 690 }, // 09:00-11:30
    ];

    const data: any[] = [];

    for (const t of templates) {
      for (const mt of meetingTypes) {
        if (mt === 'OFFLINE' && !clinicId) continue;

        data.push({
          doctorId,
          clinicId: mt === 'OFFLINE' ? clinicId : null,
          meetingType: mt,
          dayOfWeek: t.dayOfWeek,
          timeOfDay: t.timeOfDay,
          startMinute: t.startMinute,
          endMinute: t.endMinute,
          slotDurationMin: 15,
          capacityPerSlot: 1,
          isActive: true,
        });
      }
    }

    if (data.length === 0) {
      throw new BadRequestException('No rules generated. Provide clinicId to generate OFFLINE rules.');
    }

    const result = await this.db.doctorScheduleRule.createMany({
      data,
      skipDuplicates: true,
    });

    return { created: result.count };
  }
}
