import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { MeetingType, TimeOfDay } from '@prisma/client';

export class UpsertSessionOverrideDto {
  @IsInt()
  doctorId: number;

  @IsISO8601()
  date: string;

  meetingType: MeetingType;
  timeOfDay: TimeOfDay;

  @IsOptional()
  @IsInt()
  clinicId?: number;

  @IsOptional()
  @IsString()
  locationKey?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  startMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  endMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  slotDurationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacityPerSlot?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
