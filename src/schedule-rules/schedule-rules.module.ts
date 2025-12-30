import { Module } from '@nestjs/common';
import { ScheduleRulesController } from './schedule-rules.controller';
import { ScheduleRulesService } from './schedule-rules.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ScheduleRulesController],
  providers: [ScheduleRulesService, PrismaService],
  exports: [ScheduleRulesService],
})
export class ScheduleRulesModule {}
