import { IsInt, Min } from 'class-validator';

export class AcceptRescheduleDto {
  @IsInt()
  @Min(1)
  slotId: number;
}
