import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek, MeetingType, TimeOfDay } from '@prisma/client';

export class CreateScheduleRuleDto {
  @Type(() => Number)
  @IsInt()
  doctorId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clinicId?: number | null;

  @IsEnum(MeetingType)
  meetingType: MeetingType;

  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsEnum(TimeOfDay)
  timeOfDay: TimeOfDay;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  startMinute: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  endMinute: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  slotDurationMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  capacityPerSlot?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
