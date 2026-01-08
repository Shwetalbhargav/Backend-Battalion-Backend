import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MeetingType, SlotStatus, TimeOfDay } from '@prisma/client';

import { AvailabilitySlotsService } from './availability-slots.service';
import { GenerateSlotsDto } from './dto/generate-slots.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';

// Kept local on purpose to avoid adding new files while still keeping strong typing.
type CreateExtraSlotsDto = {
  doctorId: string | number;
  date: string;
  meetingType: MeetingType;
  timeOfDay: TimeOfDay;
  startMinute: number;
  endMinute: number;
  slotDurationMin?: number;
  capacity?: number;
  clinicId?: number | null;
};

@Controller('availability-slots')
export class AvailabilitySlotsController {
  constructor(
    private readonly availabilitySlotsService: AvailabilitySlotsService,
  ) {}

  @Post('generate')
  generate(@Body() dto: GenerateSlotsDto) {
    return this.availabilitySlotsService.generateSlots(
      String(dto.doctorId),
      dto.dateFrom,
      dto.dateTo,
    );
  }

  /**
   * GET /availability-slots/search
   * Supports either:
   *  - ?doctorId=1&date=YYYY-MM-DD
   *  - ?doctorId=1&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
   * Optional filters:
   *  - meetingType=ONLINE|OFFLINE
   *  - timeOfDay=MORNING|EVENING
   *  - status=AVAILABLE|UNAVAILABLE|FULL
   */
  @Get('search')
  search(
    @Query('doctorId') doctorId?: string,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('meetingType') meetingType?: MeetingType,
    @Query('timeOfDay') timeOfDay?: TimeOfDay,
    @Query('status') status?: SlotStatus,
  ) {
    if (!doctorId) throw new BadRequestException('doctorId is required');

    // If `date` is passed, treat it as a same-day range.
    const from = date ?? dateFrom;
    const to = date ?? dateTo;

    if (!from || !to) {
      throw new BadRequestException('Provide either date OR dateFrom & dateTo');
    }

    return this.availabilitySlotsService.searchSlots({
      doctorId,
      dateFrom: from,
      dateTo: to,
      meetingType,
      timeOfDay,
      status,
    });
  }

  @Patch(':id')
  updateSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSlotDto,
  ) {
    return this.availabilitySlotsService.updateSlot(id, dto);
  }

  @Post('create-extra')
  createExtra(@Body() dto: CreateExtraSlotsDto) {
    return this.availabilitySlotsService.createExtraSlots({
      doctorId: String(dto.doctorId),
      date: dto.date,
      meetingType: dto.meetingType,
      timeOfDay: dto.timeOfDay,
      startMinute: dto.startMinute,
      endMinute: dto.endMinute,
      slotDurationMin: dto.slotDurationMin,
      capacity: dto.capacity,
      clinicId: dto.clinicId ?? null,
    });
  }
}
