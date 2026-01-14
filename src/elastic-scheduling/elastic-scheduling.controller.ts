import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { ElasticSchedulingService } from './elastic-scheduling.service';
import { ExpandSessionDto } from './dto/expand-session.dto';
import { ShrinkSessionDto } from './dto/shrink-session.dto';
import { UpdateCapacityDto } from './dto/update-capacity.dto';
import { MeetingType, TimeOfDay } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

function dayStartUtcFromISO(dateISO: string): Date {
  // expecting YYYY-MM-DD
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) throw new BadRequestException('dateISO must be YYYY-MM-DD');
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/**
 * NEW: request body for “confirmed recurring → custom reflection”
 * Keep this in controller so you don't need to create a new dto file right now.
 */
class ConfirmedForSessionKeyDto {
  @Type(() => Number)
  @IsInt()
  doctorId!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateISO must be YYYY-MM-DD' })
  dateISO!: string;

  @IsEnum(MeetingType)
  meetingType!: MeetingType;

  @IsEnum(TimeOfDay)
  timeOfDay!: TimeOfDay;

  @IsOptional()
  @IsString()
  locationKey?: string;
}

@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  }),
)
@Controller('elastic-scheduling')
export class ElasticSchedulingController {
  constructor(private readonly service: ElasticSchedulingService) {}

  /**
   * Iteration: Expand (open wider minute window) for ACTIVE session via override
   * POST /api/v1/elastic-scheduling/session/expand
   */
  @Post('session/expand')
  expandSession(@Body() dto: ExpandSessionDto) {
    return this.service.expandSession(dto);
  }

  /**
   * Iteration: Shrink (close minute window) for ACTIVE session via override
   * POST /api/v1/elastic-scheduling/session/shrink
   */
  @Post('session/shrink')
  shrinkSession(@Body() dto: ShrinkSessionDto) {
    return this.service.shrinkSession(dto);
  }

  /**
   * Iteration: Capacity +/- for ACTIVE session (WAVE / STREAM)
   * POST /api/v1/elastic-scheduling/session/capacity
   */
  @Post('session/capacity')
  updateCapacity(@Body() dto: UpdateCapacityDto) {
    return this.service.updateCapacity(dto);
  }

  /**
   * NEW — “confirmed recurring → custom reflection”
   * POST /api/v1/elastic-scheduling/session/confirmed
   *
   * Returns confirmed appointments for the provided “session key”.
   * Useful if your UI switches from recurring-session identity to custom-session identity.
   */
  @Post('session/confirmed')
  getConfirmedForSession(@Body() dto: ConfirmedForSessionKeyDto) {
    return this.service.getConfirmedAppointmentsForSessionKey({
      doctorId: dto.doctorId,
      date: dayStartUtcFromISO(dto.dateISO),
      meetingType: dto.meetingType,
      timeOfDay: dto.timeOfDay,
      locationKey: dto.locationKey,
    });
  }
}
