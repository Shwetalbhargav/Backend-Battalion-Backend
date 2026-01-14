// src/appointments/appointments.module.ts
import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentRescheduleOffersModule } from '../reschedule-offers/reschedule-offers.module';

@Module({
  imports: [PrismaModule,AppointmentRescheduleOffersModule,],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
