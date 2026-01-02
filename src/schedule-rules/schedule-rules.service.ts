import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';

@Injectable()
export class ScheduleRulesService {
  constructor(private readonly prisma: PrismaService) {}

  private toInt(value: unknown, field: string): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return n;
  }

  async create(dto: CreateScheduleRuleDto) {
    const doctorId = this.toInt(dto.doctorId, 'doctorId');

    return this.prisma.doctorScheduleRule.create({
      data: {
        doctorId,
        clinicId: dto.clinicId == null ? null : this.toInt(dto.clinicId, 'clinicId'),
        dayOfWeek: dto.dayOfWeek,
        meetingType: dto.meetingType,
        timeOfDay: dto.timeOfDay,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        slotDurationMin: dto.slotDurationMin,
        capacityPerSlot: dto.capacityPerSlot,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(query?: { doctorId?: string }) {
    // ✅ ALWAYS initialize where
    const where: { doctorId?: number } = {};

    if (query?.doctorId) {
      const parsedDoctorId = Number(query.doctorId);
      if (Number.isNaN(parsedDoctorId)) {
        throw new BadRequestException('doctorId must be a number');
      }
      where.doctorId = parsedDoctorId;
    }

    return this.prisma.doctorScheduleRule.findMany({
      where,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: string) {
    const ruleId = this.toInt(id, 'id');

    const rule = await this.prisma.doctorScheduleRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) throw new NotFoundException('Schedule rule not found');
    return rule;
  }

  async update(id: string, dto: UpdateScheduleRuleDto) {
    const ruleId = this.toInt(id, 'id');
    await this.findOne(String(ruleId));

    const data: any = {
      dayOfWeek: dto.dayOfWeek,
      meetingType: dto.meetingType,
      timeOfDay: dto.timeOfDay,
      startMinute: dto.startMinute,
      endMinute: dto.endMinute,
      slotDurationMin: dto.slotDurationMin,
      capacityPerSlot: dto.capacityPerSlot,
      isActive: dto.isActive,
    };

    if (dto.clinicId !== undefined) {
      data.clinicId = dto.clinicId === null ? null : this.toInt(dto.clinicId, 'clinicId');
    }

    if (dto.doctorId !== undefined) {
      data.doctorId = this.toInt(dto.doctorId, 'doctorId');
    }

    return this.prisma.doctorScheduleRule.update({
      where: { id: ruleId },
      data,
    });
  }

  async remove(id: string) {
    const ruleId = this.toInt(id, 'id');
    await this.findOne(String(ruleId));

    return this.prisma.doctorScheduleRule.delete({
      where: { id: ruleId },
    });
  }
}
