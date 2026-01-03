import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpsertDayOverrideDto {
  @IsInt()
  doctorId: number;

  @IsISO8601()
  date: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
