import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek, MeetingType, SchedulingStrategy, TimeOfDay } from '@prisma/client';

export class BulkSessionDto {
  @IsEnum(TimeOfDay)
  timeOfDay: TimeOfDay;

  @IsString()
  @IsNotEmpty()
  startTime: string; // "09:00"

  @IsString()
  @IsNotEmpty()
  endTime: string; // "12:00"
}

export class BulkScheduleRulesDto {
  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @IsEnum(MeetingType)
  meetingType: MeetingType;

  @IsDateString()
  dateFrom: string; // "2026-01-05"

  @IsDateString()
  dateTo: string; // "2026-01-12"

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(DayOfWeek, { each: true })
  daysOfWeek: DayOfWeek[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkSessionDto)
  sessions: BulkSessionDto[];

  /**
   * STREAM fields
   */
  @IsOptional()
  @IsInt()
  @Min(5)
  slotDurationMin?: number; // default 15

  @IsOptional()
  @IsInt()
  @Min(1)
  capacityPerSlot?: number; // default 1

  /**
   * New: STREAM | WAVE
   */
  @IsOptional()
  @IsEnum(SchedulingStrategy)
  strategy?: SchedulingStrategy; // default STREAM

  /**
   * WAVE (simple mode): requires waveEveryMin + waveCapacity if wavePattern not provided
   */
  @ValidateIf((o) => (o.strategy ?? SchedulingStrategy.STREAM) === SchedulingStrategy.WAVE && !o.wavePattern)
  @IsInt()
  @Min(5)
  waveEveryMin?: number;

  @ValidateIf((o) => (o.strategy ?? SchedulingStrategy.STREAM) === SchedulingStrategy.WAVE && !o.wavePattern)
  @IsInt()
  @Min(1)
  waveCapacity?: number;

  /**
   * WAVE (pattern mode): JSON array like:
   * [{ offsetMin: 0, capacity: 3 }, { offsetMin: 15, capacity: 1 }]
   */
  @ValidateIf((o) => (o.strategy ?? SchedulingStrategy.STREAM) === SchedulingStrategy.WAVE)
  @IsOptional()
  @IsObject()
  wavePattern?: Record<string, any>;

  /**
   * OFFLINE helpers
   */
  @IsOptional()
  clinicId?: string;

  @IsOptional()
  @IsString()
  locationKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
