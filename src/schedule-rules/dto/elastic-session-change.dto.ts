import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { MeetingType, TimeOfDay } from '@prisma/client';

/**
 * Single date + single session elastic change request.
 */
export class ElasticSessionChangeDto {
  @Type(() => Number)
  @IsInt()
  doctorId: number;

  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsEnum(MeetingType)
  meetingType: MeetingType;

  @IsEnum(TimeOfDay)
  timeOfDay: TimeOfDay;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clinicId?: number;

  @IsOptional()
  @IsString()
  locationKey?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  startMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  endMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(240)
  slotDurationMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  capacityPerSlot?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  bufferMin?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
