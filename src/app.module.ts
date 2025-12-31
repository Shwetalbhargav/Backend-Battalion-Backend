import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';

import { ScheduleRulesModule } from './schedule-rules/schedule-rules.module';
import { AvailabilitySlotsModule } from './availability-slots/availability-slots.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
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
