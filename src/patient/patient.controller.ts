import { Controller, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { PatientService } from './patient.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientOnly } from '../auth/guards/patient-only.guard';

@Controller('patient')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // ✅ Only PATIENT users can create patient profile
  // ✅ userId comes from JWT (Google OAuth login)
  @Post()
  @PatientOnly()
  create(@Req() req: any, @Body() dto: CreatePatientDto) {
    return this.patientService.create({
      ...dto,
      userId: req.user.id,
    });
  }

  // Up to you: make public OR protect later
  @Get()
  findAll() {
    return this.patientService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patientService.findOne(id);
  }

  @Patch(':id')
  @PatientOnly()
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientService.update(id, dto);
  }

  @Delete(':id')
  @PatientOnly()
  remove(@Param('id') id: string) {
    return this.patientService.remove(id);
  }
}
