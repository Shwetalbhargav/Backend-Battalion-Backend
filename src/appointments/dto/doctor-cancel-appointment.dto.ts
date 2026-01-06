// src/appointments/dto/doctor-cancel-appointment.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class DoctorCancelAppointmentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
