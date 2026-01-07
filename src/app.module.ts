// src/app.module.ts
import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';

import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';

import { ScheduleRulesModule } from './schedule-rules/schedule-rules.module';
import { AvailabilitySlotsModule } from './availability-slots/availability-slots.module';
import { AppointmentsModule } from './appointments/appointments.module';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    PrismaModule,


    UsersModule,
    DoctorModule,
    PatientModule,


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
    AppointmentsModule,
 

  ],
  controllers: [HealthController],
})
export class AppModule {}
