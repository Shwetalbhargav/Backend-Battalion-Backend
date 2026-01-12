import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentRescheduleOffersService } from './appointment-reschedule-offers.service';

@Module({
  imports: [PrismaModule],
  providers: [AppointmentRescheduleOffersService],
  exports: [AppointmentRescheduleOffersService], // ✅ key line
})
export class RescheduleOffersModule {}
