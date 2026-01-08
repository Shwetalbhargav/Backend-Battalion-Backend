import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorOnly } from '../auth/guards/doctor-only.guard';
import { AppointmentStatus, MeetingType, TimeOfDay } from '@prisma/client';

@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  // -----------------------------
  // Doctor Profile CRUD (keep)
  // -----------------------------

  @Post()
  @DoctorOnly()
  create(@Req() req: any, @Body() dto: CreateDoctorDto) {
    // enforce doctor can only create their own profile
    return this.doctorService.create(req.user.id, dto);
  }

  @Get()
  findAll() {
    return this.doctorService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.doctorService.findOne(id);
  }

  @Patch(':id')
  @DoctorOnly()
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDoctorDto) {
    return this.doctorService.updateAsDoctor(req.user.id, id, dto);
  }

  @Delete(':id')
  @DoctorOnly()
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.doctorService.removeAsDoctor(req.user.id, id);
  }

  // -----------------------------------
  // Mapping: Doctor (me) <-> Specialties
  // -----------------------------------

  @Get('me/specialties')
  @DoctorOnly()
  listMySpecialties(@Req() req: any) {
    return this.doctorService.listMySpecialties(req.user.id);
  }

  @Post('me/specialties/:specialtyId')
  @DoctorOnly()
  addSpecialtyToMe(@Req() req: any, @Param('specialtyId', ParseIntPipe) specialtyId: number) {
    return this.doctorService.addSpecialtyToMe(req.user.id, specialtyId);
  }

  @Delete('me/specialties/:specialtyId')
  @DoctorOnly()
  removeSpecialtyFromMe(@Req() req: any, @Param('specialtyId', ParseIntPipe) specialtyId: number) {
    return this.doctorService.removeSpecialtyFromMe(req.user.id, specialtyId);
  }

  // -----------------------------------
  // Mapping: Doctor (me) <-> Services
  // -----------------------------------

  @Get('me/services')
  @DoctorOnly()
  listMyServices(@Req() req: any) {
    return this.doctorService.listMyServices(req.user.id);
  }

  @Post('me/services/:serviceId')
  @DoctorOnly()
  addServiceToMe(@Req() req: any, @Param('serviceId', ParseIntPipe) serviceId: number) {
    return this.doctorService.addServiceToMe(req.user.id, serviceId);
  }

  @Delete('me/services/:serviceId')
  @DoctorOnly()
  removeServiceFromMe(@Req() req: any, @Param('serviceId', ParseIntPipe) serviceId: number) {
    return this.doctorService.removeServiceFromMe(req.user.id, serviceId);
  }

  // -----------------------------
  // Search Doctors
  // -----------------------------

  // GET /doctor/search/by-specialty?specialtyId=1
  // GET /doctor/search/by-specialty?name=cardio
  @Get('search/by-specialty')
  searchBySpecialty(@Query('specialtyId') specialtyId?: string, @Query('name') name?: string) {
    const sid = specialtyId ? Number(specialtyId) : undefined;
    if (specialtyId && (!Number.isInteger(sid) || sid <= 0)) {
      throw new BadRequestException('specialtyId must be a positive integer');
    }

    return this.doctorService.searchDoctorsBySpecialty({
      specialtyId: sid,
      name: name?.trim(),
    });
  }

  // GET /doctor/search/by-availability?date=2026-01-07&meetingType=ONLINE&timeOfDay=MORNING&startMinute=540&endMinute=720
  @Get('search/by-availability')
  searchByAvailability(
    @Query('date') date: string,
    @Query('meetingType') meetingType?: MeetingType,
    @Query('timeOfDay') timeOfDay?: TimeOfDay,
    @Query('startMinute') startMinute?: string,
    @Query('endMinute') endMinute?: string,
  ) {
    if (!date) throw new BadRequestException('date is required (YYYY-MM-DD)');

    const sm = startMinute !== undefined ? Number(startMinute) : undefined;
    const em = endMinute !== undefined ? Number(endMinute) : undefined;

    if (startMinute !== undefined && (!Number.isFinite(sm) || sm < 0)) {
      throw new BadRequestException('startMinute must be a non-negative number');
    }
    if (endMinute !== undefined && (!Number.isFinite(em) || em < 0)) {
      throw new BadRequestException('endMinute must be a non-negative number');
    }

    return this.doctorService.searchDoctorsByAvailability({
      date,
      meetingType,
      timeOfDay,
      startMinute: sm,
      endMinute: em,
    });
  }

  // GET /doctor/search/by-appointments?status=BOOKED&from=2026-01-01&to=2026-01-31
  @Get('search/by-appointments')
  searchByAppointments(
    @Query('status') status?: AppointmentStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.doctorService.searchDoctorsByAppointments({ status, from, to });
  }
}
