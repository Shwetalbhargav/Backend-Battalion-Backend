
import { MeetingType, TimeOfDay } from '@prisma/client';
import { IsDateString, IsEnum,IsOptional, IsInt, Min, Max } from 'class-validator';

export enum MeetingType {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export enum TimeOfDay {
  MORNING = 'MORNING',
  EVENING = 'EVENING',
}

export enum ElasticStrategy {
  WAVE = 'WAVE',
  STREAM = 'STREAM',
}


export class BaseSessionDto {
  doctorId: number;

  // API input (YYYY-MM-DD)
  date: string;

  // ✅ MUST be Prisma enums (not string)
  meetingType: MeetingType;
  timeOfDay: TimeOfDay;


  // ✅ REQUIRED for session identity consistency
  locationKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  bufferMinutes?: number;

}
