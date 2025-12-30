import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { ScheduleRulesModule } from './schedule-rules/schedule-rules.module';
import { AvailabilitySlotsModule } from './availability-slots/availability-slots.module';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('db')
  async db() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}
@Module({
  imports: [
    // 🔥 MUST BE FIRST
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

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
