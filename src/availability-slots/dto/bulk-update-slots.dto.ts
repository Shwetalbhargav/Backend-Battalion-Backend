import { IsIn, IsOptional, IsString } from 'class-validator';

export class BulkUpdateSlotsDto {
  @IsString()
  doctorId: string;

  @IsString()
  dateFrom: string; // YYYY-MM-DD

  @IsString()
  dateTo: string; // YYYY-MM-DD

  @IsOptional()
  @IsIn(['ONLINE', 'OFFLINE'])
  meetingType?: 'ONLINE' | 'OFFLINE';

  @IsOptional()
  @IsIn(['MORNING', 'EVENING'])
  timeOfDay?: 'MORNING' | 'EVENING';

  // doctor action: block/unblock
  @IsIn(['AVAILABLE', 'UNAVAILABLE'])
  status: 'AVAILABLE' | 'UNAVAILABLE';
}
