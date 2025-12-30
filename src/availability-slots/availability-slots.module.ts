import { Module } from '@nestjs/common';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { AvailabilitySlotsService } from './availability-slots.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AvailabilitySlotsController],
  providers: [AvailabilitySlotsService, PrismaService],
})
export class AvailabilitySlotsModule {}
