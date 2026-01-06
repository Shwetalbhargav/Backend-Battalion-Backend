// src/app.module.ts
import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { ScheduleRulesModule } from './schedule-rules/schedule-rules.module';
import { AvailabilitySlotsModule } from './availability-slots/availability-slots.module';
import { ElasticSchedulingModule } from './elastic-scheduling/elastic-scheduling.module';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    return { ok: true};
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

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
    ElasticSchedulingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
