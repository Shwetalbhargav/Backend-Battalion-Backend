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

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
  ) {}

  /* =====================================================
     PATIENT APIs
     ===================================================== */

  // Book appointment
  @Post()
  @Roles(Role.PATIENT)
  bookAppointment(@Req() req, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.bookAppointment(
      req.user.id,
      dto.slotId,
      dto.note,
    );
  }

  // View my appointments
  @Get('my')
  @Roles(Role.PATIENT)
  getMyAppointments(@Req() req) {
    return this.appointmentsService.getMyAppointments(req.user.id);
  }

  // Cancel appointment
  @Patch(':id/cancel')
  @Roles(Role.PATIENT)
  cancelAppointment(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancelAppointmentByPatient(
      req.user.id,
      id,
      dto.reason,
    );
  }

  // Delete appointment (only if cancelled)
  @Delete(':id')
  @Roles(Role.PATIENT)
  deleteAppointment(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.appointmentsService.deleteAppointmentByPatient(
      req.user.id,
      id,
    );
  }

  /* =====================================================
     DOCTOR APIs
     ===================================================== */

  // View my appointments
  @Get('doctor/my')
  @Roles(Role.DOCTOR)
  getDoctorAppointments(@Req() req) {
    return this.appointmentsService.getDoctorAppointments(req.user.id);
  }

  // Confirm appointment
  @Patch(':id/confirm')
  @Roles(Role.DOCTOR)
  confirmAppointment(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.appointmentsService.confirmAppointment(
      req.user.id,
      id,
    );
  }

  // Cancel appointment (doctor)
  @Patch(':id/doctor-cancel')
  @Roles(Role.DOCTOR)
  cancelAppointmentByDoctor(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DoctorCancelAppointmentDto,
  ) {
    return this.appointmentsService.cancelAppointmentByDoctor(
      req.user.id,
      id,
      dto.reason,
    );
  }
}
