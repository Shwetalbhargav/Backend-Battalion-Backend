import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorOnly } from '../auth/guards/doctor-only.guard';
import { ParseIntPipe } from '@nestjs/common';

@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  // ✅ Only DOCTOR users can create doctor profile
  // ✅ userId comes from JWT (Google OAuth login)
  @Post()
  @DoctorOnly()
  create(@Req() req: any, @Body() dto: CreateDoctorDto) {
    return this.doctorService.create({
      ...dto,
      userId: req.user.id, // <- from token
    });
  }

  // Up to you: make public OR require auth
  @Get()
  findAll() {
    return this.doctorService.findAll();
  }

  // optional: protect
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.doctorService.findOne(id);
  }

  // optional: doctor-only (recommended if doctor edits own profile)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDoctorDto) {
    return this.doctorService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.doctorService.remove(id);
  }
}
