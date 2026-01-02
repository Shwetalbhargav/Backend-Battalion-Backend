import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { AvailabilitySlotsService } from './availability-slots.service';
import { GenerateSlotsDto } from './dto/generate-slots.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { MeetingType, SlotStatus, TimeOfDay } from '@prisma/client';

@Controller('api/v1/availability-slots')
export class AvailabilitySlotsController {
  constructor(private readonly availabilitySlotsService: AvailabilitySlotsService) {}

  @Post('generate')
  generate(@Body() dto: GenerateSlotsDto) {
    // Service expects string doctorId
    return this.availabilitySlotsService.generateSlots(
      String(dto.doctorId),
      dto.dateFrom,
      dto.dateTo,
    );
  }

  /**
   * GET /api/v1/availability-slots/search
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

    // If `date` is passed, treat it as same-day range.
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
  updateSlot(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSlotDto) {
    return this.availabilitySlotsService.updateSlot(id, dto);
  }

  @Post('create-extra')
  createExtra(@Body() dto: any) {
    // Service expects doctorId as string + required date/meetingType/timeOfDay/startMinute/endMinute
    return this.availabilitySlotsService.createExtraSlots({
      doctorId: String(dto.doctorId),
      date: dto.date,
      meetingType: dto.meetingType,
      timeOfDay: dto.timeOfDay,
      startMinute: dto.startMinute,
      endMinute: dto.endMinute,
      slotDurationMin: dto.slotDurationMin,
      capacity: dto.capacity,
    });
  }

  /**
   * NOTE: bulk-update is NOT implemented in AvailabilitySlotsService right now.
   * If you still want the endpoint, we’ll add `bulkUpdateSlots()` to the service.
   */
}
