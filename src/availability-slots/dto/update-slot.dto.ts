import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { SlotStatus } from '@prisma/client';

export class UpdateSlotDto {
  @IsOptional()
  @IsEnum(SlotStatus)
  status?: SlotStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  bookedCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
