import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { Prisma } from '@prisma/client';

type Day = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type MeetingType = 'ONLINE' | 'OFFLINE';
type TimeOfDay = 'MORNING' | 'EVENING';

@Injectable()
export class ScheduleRulesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateWindow(start: number, end: number) {
    if (end <= start) throw new BadRequestException('endMinute must be greater than startMinute');
    if (start < 0 || end > 1440) throw new BadRequestException('Minutes must be between 0 and 1440');
  }

  async create(dto: CreateScheduleRuleDto) {
    this.validateWindow(dto.startMinute, dto.endMinute);

    if (dto.meetingType === 'OFFLINE' && !dto.clinicId) {
      throw new BadRequestException('clinicId is required for OFFLINE schedule rule');
    }

    return this.prisma.doctorScheduleRule.create({
      data: {
        doctorId: dto.doctorId,
        clinicId: dto.clinicId ?? null,
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
    return this.prisma.doctorScheduleRule.findMany({
      where: doctorId ? { doctorId } : undefined,
      orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
  }

  /**
   * Bulk-create your exact defaults:
   * Mon–Fri: Morning 10–13, Evening 18–22
   * Sat: Morning 9–11:30
   * For BOTH meeting types ONLINE and OFFLINE
   */
  async bulkCreateDefaults(doctorId: string, clinicId?: string) {
    const weekdays: Day[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const meetingTypes: MeetingType[] = ['ONLINE', 'OFFLINE'];

    const templates: Array<{
      dayOfWeek: Day;
      timeOfDay: TimeOfDay;
      startMinute: number;
      endMinute: number;
    }> = [
      // Mon-Fri morning 10:00–13:00
      ...weekdays.map((d) => ({ dayOfWeek: d, timeOfDay: 'MORNING' as const, startMinute: 600, endMinute: 780 })),
      // Mon-Fri evening 18:00–22:00
      ...weekdays.map((d) => ({ dayOfWeek: d, timeOfDay: 'EVENING' as const, startMinute: 1080, endMinute: 1320 })),
      // Saturday morning 9:00–11:30
      { dayOfWeek: 'SAT', timeOfDay: 'MORNING', startMinute: 540, endMinute: 690 },
    ];

    const data: Prisma.DoctorScheduleRuleCreateManyInput[] = [];
    for (const t of templates) {
      for (const mt of meetingTypes) {
        if (mt === 'OFFLINE' && !clinicId) {
          // We skip OFFLINE if clinicId isn't provided (keeps it safe)
          continue;
        }
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

    // createMany ignores duplicates only if you set skipDuplicates: true
    // This works nicely if you rerun defaults.
    const result = await this.prisma.doctorScheduleRule.createMany({
      data,
      skipDuplicates: true,
    });

    return { created: result.count };
  }
}
