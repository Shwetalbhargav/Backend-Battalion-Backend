import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { AvailabilitySlotsModule } from './availability-slots/availability-slots.module';
import { ScheduleRulesModule } from './schedule-rules/schedule-rules.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    DoctorModule,
    PatientModule,
    AvailabilitySlotsModule,
    ScheduleRulesModule,
  ],
})
export class AppModule {}
