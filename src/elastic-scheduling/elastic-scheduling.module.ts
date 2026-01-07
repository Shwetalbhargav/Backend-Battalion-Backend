import { Module } from '@nestjs/common';
import { ElasticSchedulingController } from './elastic-scheduling.controller';
import { ElasticSchedulingService } from './elastic-scheduling.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ElasticSchedulingController],
  providers: [ElasticSchedulingService, PrismaService],
  exports: [ElasticSchedulingService],
})
export class ElasticSchedulingModule {}
