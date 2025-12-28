import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DoctorModule,
    PatientModule,
    UsersModule,
  ],
})
export class AppModule {}
