import { Module } from '@nestjs/common';
import { ScheduleRulesController } from './schedule-rules.controller';
import { ScheduleRulesService } from './schedule-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilitySlotsModule } from '../availability-slots/availability-slots.module';

@Module({
  imports: [AvailabilitySlotsModule],
  controllers: [ScheduleRulesController],
  providers: [ScheduleRulesService, PrismaService],
  exports: [ScheduleRulesService],
})
export class ScheduleRulesModule {}
