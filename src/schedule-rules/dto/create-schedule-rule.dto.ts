import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateScheduleRuleDto {
  @IsString()
  doctorId: string;

  @IsOptional()
  @IsString()
  clinicId?: string;

  @IsEnum(['ONLINE', 'OFFLINE'])
  meetingType: 'ONLINE' | 'OFFLINE';

  @IsEnum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
  dayOfWeek: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

  @IsEnum(['MORNING', 'EVENING'])
  timeOfDay: 'MORNING' | 'EVENING';

  @IsInt()
  @Min(0)
  startMinute: number;

  @IsInt()
  @Min(1)
  endMinute: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  slotDurationMin?: number; // default 15

  @IsOptional()
  @IsInt()
  @Min(1)
  capacityPerSlot?: number; // default 1

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
