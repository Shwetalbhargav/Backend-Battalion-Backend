// src/app.module.ts
import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
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
    UsersModule,
    ScheduleRulesModule,
    AvailabilitySlotsModule,
    AuthModule,
    ScheduleRulesModule,
    AvailabilitySlotsModule,
 intern/shwetal-main
  ],
})
export class AppModule {}
