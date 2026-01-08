// src/reschedule-offers/dto/create-reschedule-offers.dto.ts
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class CreateRescheduleOffersDto {
  @IsInt()
  @Min(1)
  appointmentId: number;

  @IsInt()
  @Min(1)
  doctorId: number;

  /**
   * The 3 suggested slotIds to offer (STREAM: exact slots, WAVE: capacity windows)
   */
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  slotIds: number[];

  /**
   * Auto-move fallback slotId (earliest offered, forward-only)
   */
  @IsInt()
  @Min(1)
  autoMoveSlotId: number;

  /**
   * When offers expire. Worker will auto-move if not accepted.
   * Use ISO string in API / internal calls.
   */
  @IsDateString()
  expiresAt: string;

  /**
   * Which doctor initiated shrink/override that created these offers
   */
  @IsInt()
  @Min(1)
  createdByDoctorId: number;

  /**
   * Reason shown in audit/notifications (optional but recommended)
   */
  @IsOptional()
  @IsString()
  reason?: string;
}
