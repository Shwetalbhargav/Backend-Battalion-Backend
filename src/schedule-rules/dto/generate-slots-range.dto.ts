import { IsInt, IsISO8601 } from 'class-validator';

export class GenerateSlotsRangeDto {
  @IsInt()
  doctorId: number;

  @IsISO8601()
  dateFrom: string;

  @IsISO8601()
  dateTo: string;
}
