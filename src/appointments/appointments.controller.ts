// src/appointments/appointments.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { DoctorCancelAppointmentDto } from './dto/doctor-cancel-appointment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AppointmentRescheduleOffersService } from '../reschedule-offers/appointment-reschedule-offers.service';
import { IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

type AuthUser = { id: number | string; role?: Role };
type AuthReqShape = { user: AuthUser };

function hasAuthShape(value: unknown): value is AuthReqShape {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.user !== 'object' || v.user === null) return false;
  const user = v.user as Record<string, unknown>;
  return typeof user.id === 'number' || typeof user.id === 'string';
}

function getUserId(req: unknown): number {
  if (!hasAuthShape(req)) throw new Error('Request user is missing');
  const id = Number(req.user.id);
  if (!Number.isFinite(id)) throw new Error('Invalid user id');
  return id;
}

function getUserRole(req: unknown): Role {
  if (!hasAuthShape(req)) throw new Error('Request user is missing');
  const role = req.user.role;
  if (!role) throw new BadRequestException('Request user role is missing');
  return role;
}

class AcceptRescheduleDto {
  @Type(() => Number)
  @IsInt()
  slotId!: number;
}

class DoctorShiftDto {
  @Type(() => Number)
  @IsInt()
  shiftMinutes!: number;
}

class DoctorSelectedShiftDto extends DoctorShiftDto {
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  appointmentIds!: number[];
}

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly rescheduleOffersService: AppointmentRescheduleOffersService,
  ) {}

  /* =====================================================
     PATIENT APIs
     ===================================================== */

  // Book appointment
  @Post()
  @Roles(Role.PATIENT)
  bookAppointment(@Req() req: unknown, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.bookAppointment(getUserId(req), dto.slotId, {
      note: dto.note, // ✅ align with service opts signature
      // allowFutureDayBooking: true, // wire to flag later
      // autoBookNextAvailableDayIfOver: true, // wire to flag later
    });
  }

  // View my appointments
  @Get('my')
  @Roles(Role.PATIENT)
  getMyAppointments(@Req() req: unknown) {
    return this.appointmentsService.getMyAppointments(getUserId(req));
  }

  // Cancel appointment
  @Patch(':id/cancel')
  @Roles(Role.PATIENT)
  cancelAppointment(
    @Req() req: unknown,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancelAppointmentByPatient(
      getUserId(req),
      id,
      dto.reason,
    );
  }

  // Delete appointment (only if cancelled)
  @Delete(':id')
  @Roles(Role.PATIENT)
  deleteAppointment(@Req() req: unknown, @Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.deleteAppointmentByPatient(getUserId(req), id);
  }

  /* =====================================================
     DOCTOR APIs
     ===================================================== */

  // View my appointments
  @Get('doctor/my')
  @Roles(Role.DOCTOR)
  getDoctorAppointments(@Req() req: unknown) {
    return this.appointmentsService.getDoctorAppointments(getUserId(req));
  }

  // Confirm appointment
  @Patch(':id/confirm')
  @Roles(Role.DOCTOR)
  confirmAppointment(@Req() req: unknown, @Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.confirmAppointment(getUserId(req), id);
  }

  // Cancel appointment (doctor)
  @Patch(':id/doctor-cancel')
  @Roles(Role.DOCTOR)
  cancelAppointmentByDoctor(
    @Req() req: unknown,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DoctorCancelAppointmentDto,
  ) {
    return this.appointmentsService.cancelAppointmentByDoctor(
      getUserId(req),
      id,
      dto.reason,
    );
  }

  /* =====================================================
     RESCHEDULE OFFERS (view)
     ===================================================== */

  // Patient or doctor can view active offers for an appointment
  @Get(':id/reschedule-offers')
  @Roles(Role.PATIENT, Role.DOCTOR)
  getRescheduleOffers(@Req() req: unknown, @Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.getRescheduleOffersForAppointment({
      userId: getUserId(req),
      role: getUserRole(req),
      appointmentId: id,
    });
  }

  /* =====================================================
     RESCHEDULE OFFERS (patient actions) — keeping your existing module service
     ===================================================== */

  @Post(':id/reschedule/accept')
  @Roles(Role.PATIENT)
  acceptRescheduleOffer(
    @Req() req: unknown,
    @Param('id', ParseIntPipe) appointmentId: number,
    @Body() dto: AcceptRescheduleDto,
  ) {
    return this.rescheduleOffersService.acceptOffer({
      appointmentId,
      patientId: getUserId(req),
      slotId: dto.slotId,
    });
  }

  @Post(':id/reschedule/decline')
  @Roles(Role.PATIENT)
  declineRescheduleOffer(@Req() req: unknown, @Param('id', ParseIntPipe) appointmentId: number) {
    return this.rescheduleOffersService.declineOffer({
      appointmentId,
      patientId: getUserId(req),
    });
  }

  /* =====================================================
     DOCTOR: bulk shift (your new service methods)
     ===================================================== */

  @Patch('doctor/reschedule-all')
  @Roles(Role.DOCTOR)
  rescheduleAllFuture(@Req() req: unknown, @Body() dto: DoctorShiftDto) {
    return this.appointmentsService.rescheduleAllFutureAppointments(getUserId(req), dto.shiftMinutes);
  }

  @Patch('doctor/reschedule-selected')
  @Roles(Role.DOCTOR)
  rescheduleSelected(@Req() req: unknown, @Body() dto: DoctorSelectedShiftDto) {
    return this.appointmentsService.rescheduleSelectedAppointments(
      getUserId(req),
      dto.appointmentIds,
      dto.shiftMinutes,
    );
  }
}
