import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSlotDto {
  @IsOptional()
  @IsEnum(['AVAILABLE', 'FULL', 'UNAVAILABLE'])
  status?: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bookedCount?: number;
}
