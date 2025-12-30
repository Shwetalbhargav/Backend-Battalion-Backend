import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { DayOfWeek, MeetingType, TimeOfDay } from '@prisma/client';

@Injectable()
export class ScheduleRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateScheduleRuleDto) {
    if (dto.doctorId === undefined || dto.doctorId === null) {
      throw new BadRequestException('doctorId is required');
    }

    return this.prisma.doctorScheduleRule.create({
      data: {
        doctorId: dto.doctorId, // ✅ number
        clinicId: (dto as any).clinicId ?? null, // ✅ number | null
        meetingType: dto.meetingType as MeetingType,
        dayOfWeek: dto.dayOfWeek as DayOfWeek,
        timeOfDay: dto.timeOfDay as TimeOfDay,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        slotDurationMin: (dto as any).slotDurationMin ?? 15,
        capacityPerSlot: (dto as any).capacityPerSlot ?? 1,
        isActive: (dto as any).isActive ?? true,
      },
    });
  }

  async findByDoctor(doctorId: number) {
    return this.prisma.doctorScheduleRule.findMany({
      where: { doctorId },
      orderBy: [{ dayOfWeek: 'asc' }, { timeOfDay: 'asc' }, { startMinute: 'asc' }],
    });
  }

  async findAll(doctorId?: number) {
  return this.prisma.doctorScheduleRule.findMany({
    where: doctorId ? { doctorId } : undefined,
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
  });
}

async bulkCreateDefaults(doctorId: number, clinicId?: number | null) {
  if (!doctorId) {
    throw new BadRequestException('doctorId is required');
  }

  const defaults = [
    { dayOfWeek: 'MON', timeOfDay: 'MORNING', startMinute: 540, endMinute: 720 },
    { dayOfWeek: 'TUE', timeOfDay: 'MORNING', startMinute: 540, endMinute: 720 },
    { dayOfWeek: 'WED', timeOfDay: 'MORNING', startMinute: 540, endMinute: 720 },
    { dayOfWeek: 'THU', timeOfDay: 'MORNING', startMinute: 540, endMinute: 720 },
    { dayOfWeek: 'FRI', timeOfDay: 'MORNING', startMinute: 540, endMinute: 720 },
  ];

  return this.prisma.doctorScheduleRule.createMany({
    data: defaults.map((d) => ({
      doctorId,
      clinicId: clinicId ?? null,
      meetingType: 'OFFLINE',
      dayOfWeek: d.dayOfWeek as any,
      timeOfDay: d.timeOfDay as any,
      startMinute: d.startMinute,
      endMinute: d.endMinute,
      slotDurationMin: 15,
      capacityPerSlot: 1,
      isActive: true,
    })),
    skipDuplicates: true,
  });
}

  async findOne(id: number) {
    const rule = await this.prisma.doctorScheduleRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Schedule rule not found');
    return rule;
  }

  async deactivate(id: number) {
    await this.findOne(id);
    return this.prisma.doctorScheduleRule.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.doctorScheduleRule.delete({ where: { id } });
  }
}
