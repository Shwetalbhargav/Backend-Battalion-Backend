import { Body, Controller, Get, Patch, Param, Post, Query } from '@nestjs/common';
import { AvailabilitySlotsService } from './availability-slots.service';
import { GenerateSlotsDto } from './dto/generate-slots.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';

@Controller('api/v1/availability-slots')
export class AvailabilitySlotsController {
  constructor(private readonly service: AvailabilitySlotsService) {}

  @Post('generate')
  generate(@Body() dto: GenerateSlotsDto) {
    return this.service.generateSlots(dto.doctorId, dto.dateFrom, dto.dateTo);
  }

  @Get('search')
  search(
    @Query('doctorId') doctorId?: string,
    @Query('date') date?: string,
    @Query('meetingType') meetingType?: 'ONLINE' | 'OFFLINE',
    @Query('timeOfDay') timeOfDay?: 'MORNING' | 'EVENING',
    @Query('status') status?: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE',
  ) {
    return this.service.search({ doctorId, date, meetingType, timeOfDay, status });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSlotDto) {
    return this.service.update(id, dto);
  }
}
