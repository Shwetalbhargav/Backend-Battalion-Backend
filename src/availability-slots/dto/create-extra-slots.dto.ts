import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateExtraSlotsDto {
  @IsString()
  doctorId: string;

  @IsString()
  date: string; // YYYY-MM-DD

  @IsIn(['ONLINE', 'OFFLINE'])
  meetingType: 'ONLINE' | 'OFFLINE';

  @IsIn(['MORNING', 'EVENING'])
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
  capacity?: number; // default 1
}
