// src/app.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { ScheduleRulesModule } from './schedule-rules/schedule-rules.module';
import { AvailabilitySlotsModule } from './availability-slots/availability-slots.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    DoctorModule,
    PatientModule,
    ScheduleRulesModule,
    AvailabilitySlotsModule,
  ],
})
export class AppModule {}
