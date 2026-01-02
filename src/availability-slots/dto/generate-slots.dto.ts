import { IsDateString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateSlotsDto {
  @Type(() => Number)
  @IsInt()
  doctorId: number;

  @IsDateString()
  dateFrom: string;

  @IsDateString()
  dateTo: string;
}
