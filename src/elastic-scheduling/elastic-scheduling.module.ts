import { Module } from '@nestjs/common';
import { ElasticSchedulingController } from './elastic-scheduling.controller';
import { ElasticSchedulingService } from './elastic-scheduling.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentRescheduleOffersModule} from '../reschedule-offers/reschedule-offers.module';

@Module({
   imports: [PrismaModule, AppointmentRescheduleOffersModule],
  controllers: [ElasticSchedulingController],
  providers: [ElasticSchedulingService],
  exports: [ElasticSchedulingService],
})
export class ElasticSchedulingModule {}
