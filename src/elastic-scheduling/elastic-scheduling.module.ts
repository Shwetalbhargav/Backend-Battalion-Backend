import { Module } from '@nestjs/common';
import { ElasticSchedulingController } from './elastic-scheduling.controller';
import { ElasticSchedulingService } from './elastic-scheduling.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RescheduleOffersModule } from '../reschedule-offers/reschedule-offers.module';

@Module({
   imports: [PrismaModule, RescheduleOffersModule],
  controllers: [ElasticSchedulingController],
  providers: [ElasticSchedulingService],
  exports: [ElasticSchedulingService],
})
export class ElasticSchedulingModule {}
