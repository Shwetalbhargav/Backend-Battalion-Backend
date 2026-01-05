import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  MeetingType,
  SchedulingStrategy,
  DayOfWeek,
  TimeOfDay,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilitySlotsService } from '../availability-slots/availability-slots.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { BulkScheduleRulesDto } from './dto/bulk-schedule-rules.dto';

@Injectable()
export class ScheduleRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilitySlotsService: AvailabilitySlotsService,
  ) {}

  private toIntId(value: any, field: string): number {
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isInteger(n) || n <= 0) throw new BadRequestException(`${field} must be a positive integer`);
    return n;
  }

  private toNullableIntId(value: any, field: string): number | null {
    if (value === undefined || value === null || value === '') return null;
    return this.toIntId(value, field);
  }

  private validateWindow(startMinute: number, endMinute: number) {
    if (startMinute < 0 || startMinute > 1440) throw new BadRequestException('startMinute must be 0..1440');
    if (endMinute < 0 || endMinute > 1440) throw new BadRequestException('endMinute must be 0..1440');
    if (endMinute <= startMinute) throw new BadRequestException('endMinute must be > startMinute');
  }

  private hhmmToMinutes(value: string, field: string): number {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!m) throw new BadRequestException(`${field} must be in HH:mm format`);
    return Number(m[1]) * 60 + Number(m[2]);
  }

  private normalizeStrategy(strategy?: SchedulingStrategy) {
    return strategy ?? SchedulingStrategy.STREAM;
  }

  private validateStrategyOrThrow(input: {
    strategy?: SchedulingStrategy;
    slotDurationMin?: number;
    capacityPerSlot?: number;
    waveEveryMin?: number;
    waveCapacity?: number;
    wavePattern?: unknown;
  }) {
    const strategy = this.normalizeStrategy(input.strategy);

    if (strategy === SchedulingStrategy.STREAM) {
      // STREAM is fine with defaults
      return;
    }

    // WAVE must have either (waveEveryMin + waveCapacity) OR wavePattern
    const hasPattern = input.wavePattern !== undefined && input.wavePattern !== null;
    const hasSimple = input.waveEveryMin !== undefined && input.waveCapacity !== undefined;

    if (!hasPattern && !hasSimple) {
      throw new BadRequestException(
        'WAVE strategy requires either (waveEveryMin + waveCapacity) OR wavePattern',
      );
    }

    if (hasSimple) {
      if ((input.waveEveryMin ?? 0) < 5) throw new BadRequestException('waveEveryMin must be >= 5');
      if ((input.waveCapacity ?? 0) < 1) throw new BadRequestException('waveCapacity must be >= 1');
    }

    if (hasPattern) {
      if (typeof input.wavePattern !== 'object') {
        throw new BadRequestException('wavePattern must be a JSON object/array');
      }
    }
  }

  async create(dto: CreateScheduleRuleDto) {
    const doctorId = this.toIntId(dto.doctorId, 'doctorId');
    const clinicId = this.toNullableIntId(dto.clinicId, 'clinicId');

    this.validateWindow(dto.startMinute, dto.endMinute);

    if (dto.meetingType === MeetingType.OFFLINE && !clinicId) {
      throw new BadRequestException('clinicId is required for OFFLINE schedule rule');
    }

    const strategy = this.normalizeStrategy(dto.strategy);

    this.validateStrategyOrThrow({
      strategy,
      slotDurationMin: dto.slotDurationMin,
      capacityPerSlot: dto.capacityPerSlot,
      waveEveryMin: dto.waveEveryMin,
      waveCapacity: dto.waveCapacity,
      wavePattern: dto.wavePattern,
    });

    // Build data object without sending JSON nulls unless needed
    const data: Prisma.DoctorScheduleRuleCreateInput = {
      doctor: { connect: { id: doctorId } },
      ...(clinicId ? { clinic: { connect: { id: clinicId } } } : {}),
      meetingType: dto.meetingType,
      dayOfWeek: dto.dayOfWeek,
      timeOfDay: dto.timeOfDay,
      startMinute: dto.startMinute,
      endMinute: dto.endMinute,
      slotDurationMin: dto.slotDurationMin ?? 15,
      capacityPerSlot: dto.capacityPerSlot ?? 1,
      isActive: dto.isActive ?? true,
      strategy,
    };

    if (strategy === SchedulingStrategy.WAVE) {
      if (dto.waveEveryMin !== undefined) (data as any).waveEveryMin = dto.waveEveryMin;
      if (dto.waveCapacity !== undefined) (data as any).waveCapacity = dto.waveCapacity;
      if (dto.wavePattern !== undefined) (data as any).wavePattern = dto.wavePattern as any;
    }

    return this.prisma.doctorScheduleRule.create({ data });
  }

  /**
   * Creates defaults: MON-SAT
   * MORNING 09:00-12:00, EVENING 18:00-22:00
   * STREAM strategy (no wave fields included)
   */
  async bulkCreateDefaults(doctorIdRaw: string, clinicIdRaw?: number | string) {
    const doctorId = this.toIntId(doctorIdRaw, 'doctorId');
    const clinicId = this.toNullableIntId(clinicIdRaw, 'clinicId');

    const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // IMPORTANT: typed array avoids never[]
    const defaultRules: Prisma.DoctorScheduleRuleCreateManyInput[] = [];

    for (const d of days) {
      defaultRules.push(
        {
          doctorId,
          clinicId,
          meetingType: MeetingType.ONLINE,
          dayOfWeek: d,
          timeOfDay: 'MORNING' as TimeOfDay,
          startMinute: 9 * 60,
          endMinute: 12 * 60,
          slotDurationMin: 15,
          capacityPerSlot: 1,
          isActive: true,
          strategy: SchedulingStrategy.STREAM,
          // waveEveryMin / waveCapacity / wavePattern omitted ✅
        },
        {
          doctorId,
          clinicId,
          meetingType: MeetingType.ONLINE,
          dayOfWeek: d,
          timeOfDay: 'EVENING' as TimeOfDay,
          startMinute: 18 * 60,
          endMinute: 22 * 60,
          slotDurationMin: 15,
          capacityPerSlot: 1,
          isActive: true,
          strategy: SchedulingStrategy.STREAM,
          // waveEveryMin / waveCapacity / wavePattern omitted ✅
        },
      );
    }

    const result = await this.prisma.doctorScheduleRule.createMany({
      data: defaultRules,
      skipDuplicates: true,
    });

    return { created: result.count };
  }

  /**
   * Bulk create rules AND generate slots in one go
   */
  async bulkCreateAndGenerate(dto: BulkScheduleRulesDto) {
    const doctorId = this.toIntId(dto.doctorId, 'doctorId');
    const clinicId = this.toNullableIntId(dto.clinicId, 'clinicId');

    if (dto.meetingType === MeetingType.OFFLINE && !clinicId) {
      throw new BadRequestException('clinicId is required for OFFLINE bulk rules');
    }

    const strategy = this.normalizeStrategy(dto.strategy);

    this.validateStrategyOrThrow({
      strategy,
      slotDurationMin: dto.slotDurationMin,
      capacityPerSlot: dto.capacityPerSlot,
      waveEveryMin: dto.waveEveryMin,
      waveCapacity: dto.waveCapacity,
      wavePattern: dto.wavePattern,
    });

    // Build rule records
    const records: Prisma.DoctorScheduleRuleCreateManyInput[] = [];

    for (const day of dto.daysOfWeek) {
      for (const s of dto.sessions) {
        const startMinute = this.hhmmToMinutes(s.startTime, 'sessions.startTime');
        const endMinute = this.hhmmToMinutes(s.endTime, 'sessions.endTime');
        this.validateWindow(startMinute, endMinute);

        const base: Prisma.DoctorScheduleRuleCreateManyInput = {
          doctorId,
          clinicId,
          meetingType: dto.meetingType,
          dayOfWeek: day,
          timeOfDay: s.timeOfDay,
          startMinute,
          endMinute,
          slotDurationMin: dto.slotDurationMin ?? 15,
          capacityPerSlot: dto.capacityPerSlot ?? 1,
          isActive: dto.isActive ?? true,
          strategy,
        };

        if (strategy === SchedulingStrategy.WAVE) {
          if (dto.waveEveryMin !== undefined) (base as any).waveEveryMin = dto.waveEveryMin;
          if (dto.waveCapacity !== undefined) (base as any).waveCapacity = dto.waveCapacity;
          if (dto.wavePattern !== undefined) (base as any).wavePattern = dto.wavePattern as any;
        }

        records.push(base);
      }
    }

    // Upsert loop keeps rules aligned.
    // NOTE: This compound unique name must match your schema @@unique(...)
    let rulesUpserted = 0;

    for (const r of records) {
      await this.prisma.doctorScheduleRule.upsert({
        where: {
          doctorId_meetingType_dayOfWeek_timeOfDay_startMinute_endMinute: {
            doctorId: r.doctorId,
            meetingType: r.meetingType,
            dayOfWeek: r.dayOfWeek,
            timeOfDay: r.timeOfDay,
            startMinute: r.startMinute,
            endMinute: r.endMinute,
          },
        } as any,
        update: {
          clinicId: r.clinicId,
          slotDurationMin: r.slotDurationMin,
          capacityPerSlot: r.capacityPerSlot,
          isActive: r.isActive,
          strategy: r.strategy,

          // clear wave fields if switching to STREAM
          waveEveryMin: r.strategy === SchedulingStrategy.WAVE ? (r as any).waveEveryMin ?? null : null,
          waveCapacity: r.strategy === SchedulingStrategy.WAVE ? (r as any).waveCapacity ?? null : null,
          wavePattern:
            r.strategy === SchedulingStrategy.WAVE
              ? ((r as any).wavePattern ?? Prisma.JsonNull)
              : Prisma.JsonNull,
        } as any,
        create: r as any,
      });

      rulesUpserted++;
    }

    const gen = await this.availabilitySlotsService.generateSlots(
      String(doctorId),
      dto.dateFrom,
      dto.dateTo,
    );

    return {
      rulesUpserted,
      slotsCreated: (gen as any)?.created ?? 0,
      range: { dateFrom: dto.dateFrom, dateTo: dto.dateTo },
      strategy,
    };
  }

  async listByDoctor(doctorIdRaw: string) {
    const doctorId = this.toIntId(doctorIdRaw, 'doctorId');
    return this.prisma.doctorScheduleRule.findMany({
      where: { doctorId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
  }
}
