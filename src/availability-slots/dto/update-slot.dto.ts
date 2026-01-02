import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateSlotDto {
  @IsOptional()
  @IsIn(['AVAILABLE', 'FULL', 'UNAVAILABLE'])
  status?: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE';

  @IsOptional()
  @IsInt()
  @Min(0)
  bookedCount?: number;
}
