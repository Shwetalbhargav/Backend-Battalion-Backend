import { IsDateString, IsOptional, IsString } from 'class-validator';

export class GenerateSlotsDto {
  @IsString()
  doctorId: string;

  @IsDateString()
  dateFrom: string; // YYYY-MM-DD or ISO date

  @IsDateString()
  dateTo: string; // inclusive
}
