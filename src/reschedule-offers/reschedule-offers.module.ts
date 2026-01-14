import { Module } from '@nestjs/common';
import { AppointmentRescheduleOffersService } from './appointment-reschedule-offers.service';
import { RescheduleAutoMoveWorker } from './workers/reschedule-auto-move.worker';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentRescheduleOffersController } from './appointment-reschedule-offers.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AppointmentRescheduleOffersController],
  providers: [AppointmentRescheduleOffersService, RescheduleAutoMoveWorker],
  exports: [AppointmentRescheduleOffersService],
})
export class AppointmentRescheduleOffersModule {}
