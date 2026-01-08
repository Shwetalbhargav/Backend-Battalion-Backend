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
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { DoctorCancelAppointmentDto } from './dto/doctor-cancel-appointment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

type AuthUser = { id: number | string };
type AuthReqShape = { user: AuthUser };

function hasAuthShape(value: unknown): value is AuthReqShape {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.user !== 'object' || v.user === null) return false;
  const user = v.user as Record<string, unknown>;
  return typeof user.id === 'number' || typeof user.id === 'string';
}

function getUserId(req: unknown): number {
  if (!hasAuthShape(req)) {
    throw new Error('Request user is missing');
  }
  const id = Number(req.user.id);
  if (!Number.isFinite(id)) {
    throw new Error('Invalid user id');
  }
  return id;
}

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /* =====================================================
     PATIENT APIs
     ===================================================== */

  // Book appointment
  @Post()
  @Roles(Role.PATIENT)
  bookAppointment(@Req() req: unknown, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.bookAppointment(
      getUserId(req),
      dto.slotId,
      dto.note,
    );
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
}
