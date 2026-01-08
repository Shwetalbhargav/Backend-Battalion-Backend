import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DayOfWeek,
  MeetingType,
  Prisma,
  SchedulingStrategy,
  TimeOfDay,
} from '@prisma/client';
import { AvailabilitySlotsService } from '../availability-slots/availability-slots.service';
import { PrismaService } from '../prisma/prisma.service';

import { BulkScheduleRulesDto } from './dto/bulk-schedule-rules.dto';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { GenerateSlotsRangeDto } from './dto/generate-slots-range.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';
import { UpsertDayOverrideDto } from './dto/upsert-day-override.dto';
import { UpsertSessionOverrideDto } from './dto/upsert-session-override.dto';

type FindAllQuery = {
  doctorId?: string;
  clinicId?: string;
  meetingType?: string;
};

type BulkSessionLike = {
  timeOfDay?: TimeOfDay;
  startMinute?: number;
  endMinute?: number;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
};

@Injectable()
export class ScheduleRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilitySlotsService: AvailabilitySlotsService,
  ) {}

  // -----------------------
  // helpers
  // -----------------------

  private toIntId(value: unknown, field: string): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return n;
  }

  private toNullableIntId(value: unknown, field: string): number | null {
    if (value === undefined || value === null || value === '') return null;
    return this.toIntId(value, field);
  }

  private toBool(value: unknown, fallback: boolean): boolean {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  }

  private hhmmToMinutes(value: string, field: string): number {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!m) throw new BadRequestException(`${field} must be in HH:mm format`);
    return Number(m[1]) * 60 + Number(m[2]);
  }

  private validateWindow(startMinute: number, endMinute: number): void {
    if (
      !Number.isInteger(startMinute) ||
      startMinute < 0 ||
      startMinute > 1440
    ) {
      throw new BadRequestException('startMinute must be an integer 0..1440');
    }
    if (!Number.isInteger(endMinute) || endMinute < 0 || endMinute > 1440) {
      throw new BadRequestException('endMinute must be an integer 0..1440');
    }
    if (endMinute <= startMinute) {
      throw new BadRequestException('endMinute must be > startMinute');
    }
  }

  private normalizeStrategy(strategy?: SchedulingStrategy): SchedulingStrategy {
    return strategy ?? SchedulingStrategy.STREAM;
  }

  private validateStrategyOrThrow(input: {
    strategy?: SchedulingStrategy;
    slotDurationMin?: number;
    capacityPerSlot?: number;
    waveEveryMin?: number;
    waveCapacity?: number;
    wavePattern?: unknown;
  }): void {
    const strategy = this.normalizeStrategy(input.strategy);

    const slotDurationMin = input.slotDurationMin ?? 15;
    const capacityPerSlot = input.capacityPerSlot ?? 1;

    if (!Number.isInteger(slotDurationMin) || slotDurationMin <= 0) {
      throw new BadRequestException(
        'slotDurationMin must be a positive integer',
      );
    }
    if (!Number.isInteger(capacityPerSlot) || capacityPerSlot <= 0) {
      throw new BadRequestException(
        'capacityPerSlot must be a positive integer',
      );
    }

    if (strategy === SchedulingStrategy.WAVE) {
      const waveEveryMin = input.waveEveryMin ?? 15;
      const waveCapacity = input.waveCapacity ?? capacityPerSlot;

      if (!Number.isInteger(waveEveryMin) || waveEveryMin <= 0) {
        throw new BadRequestException(
          'waveEveryMin must be a positive integer',
        );
      }
      if (!Number.isInteger(waveCapacity) || waveCapacity <= 0) {
        throw new BadRequestException(
          'waveCapacity must be a positive integer',
        );
      }
      // wavePattern can be JSON; leave validation to DTO or DB if needed
    }
  }

  private parseDateOrThrow(value: string, field: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
      throw new BadRequestException(`${field} must be a valid ISO date`);
    return d;
  }

  private normalizeSessionWindow(session: BulkSessionLike): {
    startMinute: number;
    endMinute: number;
    timeOfDay?: TimeOfDay;
  } {
    const startMinute =
      typeof session.startMinute === 'number'
        ? session.startMinute
        : typeof session.startTime === 'string'
          ? this.hhmmToMinutes(session.startTime, 'startTime')
          : Number.NaN;

    const endMinute =
      typeof session.endMinute === 'number'
        ? session.endMinute
        : typeof session.endTime === 'string'
          ? this.hhmmToMinutes(session.endTime, 'endTime')
          : Number.NaN;

    if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute)) {
      throw new BadRequestException(
        'Each session must include startMinute/endMinute or startTime/endTime',
      );
    }

    this.validateWindow(startMinute, endMinute);

    return { startMinute, endMinute, timeOfDay: session.timeOfDay };
  }

  // -----------------------
  // CRUD
  // -----------------------

  async create(dto: CreateScheduleRuleDto) {
    const doctorId = this.toIntId(
      (dto as unknown as { doctorId: unknown }).doctorId,
      'doctorId',
    );

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor)
      throw new BadRequestException(`doctorId ${doctorId} not found`);

    const data: Prisma.DoctorScheduleRuleCreateInput = {
      doctor: { connect: { id: doctorId } },
      clinicId:
        (dto as unknown as { clinicId?: number | null }).clinicId ?? null,
      meetingType: (dto as unknown as { meetingType: MeetingType }).meetingType,
      dayOfWeek: (dto as unknown as { dayOfWeek: DayOfWeek }).dayOfWeek,
      timeOfDay: (dto as unknown as { timeOfDay: TimeOfDay }).timeOfDay,
      startMinute: (dto as unknown as { startMinute: number }).startMinute,
      endMinute: (dto as unknown as { endMinute: number }).endMinute,
      slotDurationMin:
        (dto as unknown as { slotDurationMin?: number }).slotDurationMin ?? 15,
      capacityPerSlot:
        (dto as unknown as { capacityPerSlot?: number }).capacityPerSlot ?? 1,
      isActive: (dto as unknown as { isActive?: boolean }).isActive ?? true,
      strategy: this.normalizeStrategy(
        (dto as unknown as { strategy?: SchedulingStrategy }).strategy,
      ),
      waveEveryMin:
        (dto as unknown as { waveEveryMin?: number | null }).waveEveryMin ??
        null,
      waveCapacity:
        (dto as unknown as { waveCapacity?: number | null }).waveCapacity ??
        null,
      wavePattern:
        (dto as unknown as { wavePattern?: unknown }).wavePattern !== undefined
          ? ((dto as unknown as { wavePattern?: unknown })
              .wavePattern as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      locationKey:
        (dto as unknown as { locationKey?: string | null }).locationKey ?? null,
    };

    this.validateWindow(data.startMinute, data.endMinute);
    this.validateStrategyOrThrow({
      strategy: data.strategy,
      slotDurationMin: data.slotDurationMin,
      capacityPerSlot: data.capacityPerSlot,
      waveEveryMin: data.waveEveryMin ?? undefined,
      waveCapacity: data.waveCapacity ?? undefined,
      wavePattern: data.wavePattern,
    });

    if (data.meetingType === MeetingType.OFFLINE && !data.clinicId) {
      throw new BadRequestException(
        'clinicId is required for OFFLINE schedule rule',
      );
    }

    return this.prisma.doctorScheduleRule.create({ data });
  }

  async findAll(query: FindAllQuery) {
    const doctorId = query.doctorId
      ? this.toIntId(query.doctorId, 'doctorId')
      : undefined;
    const clinicId = query.clinicId
      ? this.toIntId(query.clinicId, 'clinicId')
      : undefined;
    const meetingType = query.meetingType as MeetingType | undefined;

    return this.prisma.doctorScheduleRule.findMany({
      where: {
        ...(doctorId ? { doctorId } : {}),
        ...(clinicId !== undefined ? { clinicId } : {}),
        ...(meetingType ? { meetingType } : {}),
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
  }

  async findOne(id: number) {
    const rule = await this.prisma.doctorScheduleRule.findUnique({
      where: { id },
    });
    if (!rule) throw new NotFoundException(`Schedule rule ${id} not found`);
    return rule;
  }

  async update(id: number, dto: UpdateScheduleRuleDto) {
    await this.findOne(id);

    const startMinute = (dto as unknown as { startMinute?: number })
      .startMinute;
    const endMinute = (dto as unknown as { endMinute?: number }).endMinute;
    if (startMinute !== undefined && endMinute !== undefined) {
      this.validateWindow(startMinute, endMinute);
    }

    const strategy = (dto as unknown as { strategy?: SchedulingStrategy })
      .strategy;
    if (strategy !== undefined) {
      this.validateStrategyOrThrow({
        strategy,
        slotDurationMin: (dto as unknown as { slotDurationMin?: number })
          .slotDurationMin,
        capacityPerSlot: (dto as unknown as { capacityPerSlot?: number })
          .capacityPerSlot,
        waveEveryMin: (dto as unknown as { waveEveryMin?: number })
          .waveEveryMin,
        waveCapacity: (dto as unknown as { waveCapacity?: number })
          .waveCapacity,
        wavePattern: (dto as unknown as { wavePattern?: unknown }).wavePattern,
      });
    }

    return this.prisma.doctorScheduleRule.update({
      where: { id },
      data: {
        ...dto,
        wavePattern:
          (dto as unknown as { wavePattern?: unknown }).wavePattern !==
          undefined
            ? ((dto as unknown as { wavePattern?: unknown })
                .wavePattern as Prisma.InputJsonValue)
            : undefined,
      } as Prisma.DoctorScheduleRuleUpdateInput,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.doctorScheduleRule.delete({ where: { id } });
    return { deleted: true };
  }

  // -----------------------
  // Bulk
  // -----------------------

  async bulkCreateDefaultRules(dto: BulkScheduleRulesDto) {
    const doctorId = this.toIntId(
      (dto as unknown as { doctorId: unknown }).doctorId,
      'doctorId',
    );
    const clinicId = this.toNullableIntId(
      (dto as unknown as { clinicId?: unknown }).clinicId,
      'clinicId',
    );
    const meetingType = (dto as unknown as { meetingType: MeetingType })
      .meetingType;

    if (meetingType === MeetingType.OFFLINE && !clinicId) {
      throw new BadRequestException(
        'clinicId is required for OFFLINE bulk rules',
      );
    }

    const strategy = this.normalizeStrategy(
      (dto as unknown as { strategy?: SchedulingStrategy }).strategy,
    );

    this.validateStrategyOrThrow({
      strategy,
      slotDurationMin: (dto as unknown as { slotDurationMin?: number })
        .slotDurationMin,
      capacityPerSlot: (dto as unknown as { capacityPerSlot?: number })
        .capacityPerSlot,
      waveEveryMin: (dto as unknown as { waveEveryMin?: number }).waveEveryMin,
      waveCapacity: (dto as unknown as { waveCapacity?: number }).waveCapacity,
      wavePattern: (dto as unknown as { wavePattern?: unknown }).wavePattern,
    });

    const daysOfWeek = (dto as unknown as { daysOfWeek: DayOfWeek[] })
      .daysOfWeek;
    const sessions = (dto as unknown as { sessions: BulkSessionLike[] })
      .sessions;

    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      throw new BadRequestException('daysOfWeek must be a non-empty array');
    }
    if (!Array.isArray(sessions) || sessions.length === 0) {
      throw new BadRequestException('sessions must be a non-empty array');
    }

    const slotDurationMin =
      (dto as unknown as { slotDurationMin?: number }).slotDurationMin ?? 15;
    const capacityPerSlot =
      (dto as unknown as { capacityPerSlot?: number }).capacityPerSlot ?? 1;

    let upserted = 0;

    for (const dayOfWeek of daysOfWeek) {
      for (const s of sessions) {
        const { startMinute, endMinute, timeOfDay } =
          this.normalizeSessionWindow(s);

        const inferredTimeOfDay: TimeOfDay =
          timeOfDay ??
          (startMinute < 12 * 60
            ? TimeOfDay.MORNING
            : startMinute < 17 * 60
              ? TimeOfDay.AFTERNOON
              : TimeOfDay.EVENING);

        const existing = await this.prisma.doctorScheduleRule.findFirst({
          where: {
            doctorId,
            clinicId,
            meetingType,
            dayOfWeek,
            timeOfDay: inferredTimeOfDay,
            startMinute,
            endMinute,
          },
        });

        const isActive = this.toBool(
          (dto as unknown as { isActive?: unknown }).isActive,
          true,
        );

        if (existing) {
          await this.prisma.doctorScheduleRule.update({
            where: { id: existing.id },
            data: {
              isActive,
              slotDurationMin,
              capacityPerSlot,
              strategy,
              waveEveryMin:
                strategy === SchedulingStrategy.WAVE
                  ? ((dto as unknown as { waveEveryMin?: number })
                      .waveEveryMin ?? null)
                  : null,
              waveCapacity:
                strategy === SchedulingStrategy.WAVE
                  ? ((dto as unknown as { waveCapacity?: number })
                      .waveCapacity ?? null)
                  : null,
              wavePattern:
                strategy === SchedulingStrategy.WAVE
                  ? (((dto as unknown as { wavePattern?: unknown })
                      .wavePattern ?? Prisma.JsonNull) as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
              locationKey:
                (dto as unknown as { locationKey?: string | null })
                  .locationKey ?? null,
            } as Prisma.DoctorScheduleRuleUpdateInput,
          });
        } else {
          await this.prisma.doctorScheduleRule.create({
            data: {
              doctor: { connect: { id: doctorId } },
              clinicId,
              meetingType,
              dayOfWeek,
              timeOfDay: inferredTimeOfDay,
              startMinute,
              endMinute,
              isActive,
              slotDurationMin,
              capacityPerSlot,
              strategy,
              waveEveryMin:
                strategy === SchedulingStrategy.WAVE
                  ? ((dto as unknown as { waveEveryMin?: number })
                      .waveEveryMin ?? null)
                  : null,
              waveCapacity:
                strategy === SchedulingStrategy.WAVE
                  ? ((dto as unknown as { waveCapacity?: number })
                      .waveCapacity ?? null)
                  : null,
              wavePattern:
                strategy === SchedulingStrategy.WAVE
                  ? (((dto as unknown as { wavePattern?: unknown })
                      .wavePattern ?? Prisma.JsonNull) as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
              locationKey:
                (dto as unknown as { locationKey?: string | null })
                  .locationKey ?? null,
            } as Prisma.DoctorScheduleRuleCreateInput,
          });
        }

        upserted++;
      }
    }

    return { upserted };
  }

  async bulkCreateAndGenerate(dto: BulkScheduleRulesDto) {
    const rules = await this.bulkCreateDefaultRules(dto);

    const doctorId = this.toIntId(
      (dto as unknown as { doctorId: unknown }).doctorId,
      'doctorId',
    );
    const dateFrom = (dto as unknown as { dateFrom: string }).dateFrom;
    const dateTo = (dto as unknown as { dateTo: string }).dateTo;

    const from = this.parseDateOrThrow(dateFrom, 'dateFrom');
    const to = this.parseDateOrThrow(dateTo, 'dateTo');
    if (to <= from)
      throw new BadRequestException('dateTo must be after dateFrom');

    const gen = await this.availabilitySlotsService.generateSlots(
      String(doctorId),
      dateFrom,
      dateTo,
    );

    return {
      ...rules,
      slotsCreated: (gen as unknown as { created?: number }).created ?? 0,
      range: { dateFrom, dateTo },
    };
  }

  // -----------------------
  // Slot generation
  // -----------------------

  async generateSlotsForRange(dto: GenerateSlotsRangeDto) {
    const doctorId = this.toIntId(
      (dto as unknown as { doctorId: unknown }).doctorId,
      'doctorId',
    );

    const dateFrom = (dto as unknown as { dateFrom: string }).dateFrom;
    const dateTo = (dto as unknown as { dateTo: string }).dateTo;

    const from = this.parseDateOrThrow(dateFrom, 'dateFrom');
    const to = this.parseDateOrThrow(dateTo, 'dateTo');
    if (to <= from)
      throw new BadRequestException('dateTo must be after dateFrom');

    return this.availabilitySlotsService.generateSlots(
      String(doctorId),
      dateFrom,
      dateTo,
    );
  }

  // -----------------------
  // Overrides
  // -----------------------

  async upsertDayOverride(dto: UpsertDayOverrideDto) {
    const doctorId = this.toIntId(
      (dto as unknown as { doctorId: unknown }).doctorId,
      'doctorId',
    );
    const date = (dto as unknown as { date: string }).date;

    this.parseDateOrThrow(date, 'date');

    const isClosed = this.toBool(
      (dto as unknown as { isClosed?: unknown }).isClosed,
      false,
    );
    const note = (dto as unknown as { note?: string | null }).note ?? null;

    const existing = await this.prisma.doctorDayOverride.findFirst({
      where: { doctorId, date },
    });

    const record = existing
      ? await this.prisma.doctorDayOverride.update({
          where: { id: existing.id },
          data: { isClosed, note },
        })
      : await this.prisma.doctorDayOverride.create({
          data: {
            doctor: { connect: { id: doctorId } },
            date,
            isClosed,
            note,
          } as Prisma.DoctorDayOverrideCreateInput,
        });

    await this.availabilitySlotsService.generateSlots(
      String(doctorId),
      date,
      date,
    );
    return record;
  }

  async upsertSessionOverride(dto: UpsertSessionOverrideDto) {
    const doctorId = this.toIntId(
      (dto as unknown as { doctorId: unknown }).doctorId,
      'doctorId',
    );
    const date = (dto as unknown as { date: string }).date;

    this.parseDateOrThrow(date, 'date');

    const timeOfDay = (dto as unknown as { timeOfDay: TimeOfDay }).timeOfDay;

    const startMinute = (dto as unknown as { startMinute?: number })
      .startMinute;
    const endMinute = (dto as unknown as { endMinute?: number }).endMinute;

    if (startMinute !== undefined && endMinute !== undefined) {
      this.validateWindow(startMinute, endMinute);
    }

    const isClosed = this.toBool(
      (dto as unknown as { isClosed?: unknown }).isClosed,
      false,
    );
    const note = (dto as unknown as { note?: string | null }).note ?? null;

    const existing = await this.prisma.doctorSessionOverride.findFirst({
      where: { doctorId, date, timeOfDay },
    });

    const record = existing
      ? await this.prisma.doctorSessionOverride.update({
          where: { id: existing.id },
          data: {
            isClosed,
            note,
            ...(startMinute !== undefined ? { startMinute } : {}),
            ...(endMinute !== undefined ? { endMinute } : {}),
          },
        })
      : await this.prisma.doctorSessionOverride.create({
          data: {
            doctor: { connect: { id: doctorId } },
            date,
            timeOfDay,
            isClosed,
            note,
            startMinute: startMinute ?? null,
            endMinute: endMinute ?? null,
          } as Prisma.DoctorSessionOverrideCreateInput,
        });

    await this.availabilitySlotsService.generateSlots(
      String(doctorId),
      date,
      date,
    );
    return record;
  }
}
