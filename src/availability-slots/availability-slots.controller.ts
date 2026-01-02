import { BadRequestException, Body, Controller, Get, Patch, Param, Post, Query } from '@nestjs/common';
import { AvailabilitySlotsService } from './availability-slots.service';
import { GenerateSlotsDto } from './dto/generate-slots.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { BulkUpdateSlotsDto } from './dto/bulk-update-slots.dto';
import { CreateExtraSlotsDto } from './dto/create-extra-slots.dto';
import { MeetingType, SlotStatus, TimeOfDay } from '@prisma/client';

@Controller('api/v1/availability-slots')
export class AvailabilitySlotsController {
  constructor(private readonly availabilitySlotsService: AvailabilitySlotsService) {}

  private toInt(value: string, field: string): number {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw new BadRequestException(`${field} must be a positive integer`);
    return n;
  }

  @Post('generate')
  generate(@Body() dto: GenerateSlotsDto) {
    return this.availabilitySlotsService.generateSlots(dto.doctorId, dto.dateFrom, dto.dateTo);
  }

  @Get('search')
  search(
    @Query('doctorId') doctorId?: string,
    // support both: date=YYYY-MM-DD (single day) OR dateFrom/dateTo
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('meetingType') meetingType?: MeetingType,
    @Query('timeOfDay') timeOfDay?: TimeOfDay,
    @Query('status') status?: SlotStatus,
  ) {
    if (!doctorId) throw new BadRequestException('doctorId is required');

    const from = dateFrom ?? date;
    const to = dateTo ?? date;

    if (!from || !to) {
      throw new BadRequestException('Provide either date=YYYY-MM-DD OR dateFrom & dateTo');
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
  update(@Param('id') id: string, @Body() dto: UpdateSlotDto) {
    const slotId = this.toInt(id, 'id');
    return this.availabilitySlotsService.updateSlot(slotId, dto);
  }

  // ✅ bulk block/unblock / bulk bookedCount update
  // Works with either:
  // 1) { slotIds: [1,2,3], status: "BLOCKED" }
  // 2) { updates: [{ id: 1, status: "AVAILABLE" }, { id: 2, bookedCount: 1 }] }
  @Post('bulk-update')
  async bulkUpdate(@Body() dto: BulkUpdateSlotsDto | any) {
    const updates: Array<{ id: number; data: Partial<UpdateSlotDto> }> = [];

    if (Array.isArray(dto?.updates)) {
      for (const u of dto.updates) {
        if (u?.id === undefined) continue;
        const idNum = typeof u.id === 'number' ? u.id : Number(u.id);
        if (!Number.isInteger(idNum) || idNum <= 0) continue;

        const data: Partial<UpdateSlotDto> = {};
        if (u.status !== undefined) data.status = u.status;
        if (u.bookedCount !== undefined) data.bookedCount = u.bookedCount;

        updates.push({ id: idNum, data });
      }
    } else if (Array.isArray(dto?.slotIds)) {
      const status = dto.status;
      const bookedCount = dto.bookedCount;

      if (status === undefined && bookedCount === undefined) {
        throw new BadRequestException('bulk-update requires status and/or bookedCount');
      }

      for (const rawId of dto.slotIds) {
        const idNum = typeof rawId === 'number' ? rawId : Number(rawId);
        if (!Number.isInteger(idNum) || idNum <= 0) continue;

        const data: Partial<UpdateSlotDto> = {};
        if (status !== undefined) data.status = status;
        if (bookedCount !== undefined) data.bookedCount = bookedCount;

        updates.push({ id: idNum, data });
      }
    } else {
      throw new BadRequestException('bulk-update payload must have either "updates" or "slotIds"');
    }

    const results = await Promise.all(
      updates.map((u) => this.availabilitySlotsService.updateSlot(u.id, u.data as UpdateSlotDto)),
    );

    return { updated: results.length, results };
  }

  @Post('create-extra')
  createExtra(@Body() dto: CreateExtraSlotsDto) {
    return this.availabilitySlotsService.createExtraSlots(dto);
  }
}
