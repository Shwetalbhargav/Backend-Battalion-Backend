
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,  Min,
  ValidateIf,
} from 'class-validator';
import { DayOfWeek, MeetingType, SchedulingStrategy, TimeOfDay } from '@prisma/client';
import { Type } from 'class-transformer';





export class CreateScheduleRuleDto {
  @Type(() => Number)
  @IsInt()
  doctorId: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  clinicId: number;  

  @IsEnum(MeetingType)
  meetingType: MeetingType;

  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsEnum(TimeOfDay)
  timeOfDay: TimeOfDay;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  startMinute: number; // minutes from midnight

  @Type(() => Number)
  @IsInt()

  @Min(1)
  endMinute: number; // minutes from midnight

   /**
   * STREAM defaults
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  slotDurationMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  capacityPerSlot?: number;

  /**
   * New: STREAM | WAVE
   */
  @IsOptional()
  @IsEnum(SchedulingStrategy)
  strategy?: SchedulingStrategy; // default STREAM

  /**
   * WAVE (simple mode): requires waveEveryMin + waveCapacity
   * If wavePattern is present, these can be omitted.
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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
