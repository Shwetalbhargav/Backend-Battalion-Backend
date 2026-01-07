import { IsDateString, IsEnum, IsInt, Min } from 'class-validator';

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
  @IsInt()
  @Min(1)
  doctorId: number;

  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsEnum(MeetingType)
  meetingType: MeetingType;

  @IsEnum(TimeOfDay)
  timeOfDay: TimeOfDay;
}
