import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AppointmentRescheduleOffersService } from './appointment-reschedule-offers.service';
import { AcceptRescheduleDto } from './dto/accept-reschedule.dto';
import { CreateRescheduleOffersDto } from './dto/create-reschedule-offers.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

type AuthUser = { id: number | string; role?: Role };
type AuthReqShape = { user: AuthUser };

function getUserId(req: unknown): number {
  const r = req as AuthReqShape;
  const id = Number(r?.user?.id);
  if (!Number.isFinite(id)) throw new Error('Invalid user id');
  return id;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  }),
)
@Controller('appointment-reschedule-offers')
export class AppointmentRescheduleOffersController {
  constructor(private readonly service: AppointmentRescheduleOffersService) {}

  /**
   * Doctor/system creates 3 offers + fallback for an appointment
   * POST /appointment-reschedule-offers
   */
  @Post()
  @Roles(Role.DOCTOR)
  createOffers(@Body() dto: CreateRescheduleOffersDto) {
    return this.service.createRescheduleOffers({
      appointmentId: dto.appointmentId,
      doctorId: dto.createdByDoctorId ?? dto.doctorId, // supports both fields safely
      slotIds: dto.slotIds,
      autoMoveSlotId: dto.autoMoveSlotId,
      expiresAt: dto.expiresAt,
      reason: dto.reason ?? null,
    });
  }

  /**
   * Patient fetches active (pending) offers for an appointment
   * GET /appointment-reschedule-offers/appointment/:appointmentId
   */
  @Get('appointment/:appointmentId')
  @Roles(Role.PATIENT)
  getMyPendingOffers(
    @Req() req: unknown,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
  ) {
    return this.service.getPendingOffersForAppointment(appointmentId, getUserId(req));
  }

  /**
   * Patient accepts a specific slot offer
   * POST /appointment-reschedule-offers/appointment/:appointmentId/accept
   */
  @Post('appointment/:appointmentId/accept')
  @Roles(Role.PATIENT)
  acceptOffer(
    @Req() req: unknown,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: AcceptRescheduleDto,
  ) {
    return this.service.acceptOffer({
      appointmentId,
      patientId: getUserId(req),
      slotId: dto.slotId,
    });
  }

  /**
   * Patient declines the offer group
   * POST /appointment-reschedule-offers/appointment/:appointmentId/decline
   */
  @Post('appointment/:appointmentId/decline')
  @Roles(Role.PATIENT)
  declineOffer(@Req() req: unknown, @Param('appointmentId', ParseIntPipe) appointmentId: number) {
    return this.service.declineOffer({
      appointmentId,
      patientId: getUserId(req),
    });
  }

  /**
   * (Optional) Manual trigger for the worker behavior
   * POST /appointment-reschedule-offers/auto-move/run
   */
  @Post('auto-move/run')
  @Roles(Role.DOCTOR)
  runAutoMove(@Body() body: { limit?: number }) {
    return this.service.autoMoveExpiredOffers(body?.limit ?? 50);
  }
}
