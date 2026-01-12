import { MeetingType, TimeOfDay } from '@prisma/client';

export class BaseSessionDto {
  doctorId: number;

  // API input (YYYY-MM-DD)
  date: string;

  // ✅ MUST be Prisma enums (not string)
  meetingType: MeetingType;
  timeOfDay: TimeOfDay;

  // ✅ REQUIRED for session identity consistency
  locationKey?: string;
}
