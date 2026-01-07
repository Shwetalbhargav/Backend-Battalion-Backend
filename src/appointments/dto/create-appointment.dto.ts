// src/appointments/dto/create-appointment.dto.ts
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateAppointmentDto {
  @IsInt()
  @Min(1)
  slotId: number;

  @IsOptional()
  @IsString()
  note?: string;
}
