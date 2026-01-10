// src/app.module.ts
import { PrismaModule } from "./prisma/prisma.module";
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { ScheduleRulesModule } from './schedule-rules/schedule-rules.module';
import { AvailabilitySlotsModule } from './availability-slots/availability-slots.module';
import { ElasticSchedulingModule } from './elastic-scheduling/elastic-scheduling.module';
import { AppointmentsModule } from './appointments/appointments.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    DoctorModule,
    PatientModule,
    AuthModule,
    ScheduleRulesModule,
    AvailabilitySlotsModule,
    AuthModule,
    AppointmentsModule,
    ElasticSchedulingModule,
  ],
})
export class AppModule {}
