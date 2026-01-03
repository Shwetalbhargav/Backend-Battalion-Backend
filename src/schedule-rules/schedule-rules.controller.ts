import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ScheduleRulesService } from './schedule-rules.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';

// NEW DTOs (you’ll create these)
import { GenerateSlotsRangeDto } from './dto/generate-slots-range.dto';
import { UpsertDayOverrideDto } from './dto/upsert-day-override.dto';
import { UpsertSessionOverrideDto } from './dto/upsert-session-override.dto';

@Controller('schedule-rules')
export class ScheduleRulesController {
  constructor(private readonly scheduleRulesService: ScheduleRulesService) { }

  @Post()
  create(@Body() dto: CreateScheduleRuleDto) {
    return this.scheduleRulesService.create(dto);
  }

  // Optional filter: /api/v1/schedule-rules?doctorId=1
  @Get()
  findAll(@Query('doctorId') doctorId?: string) {
    return this.scheduleRulesService.findAll(doctorId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.scheduleRulesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateScheduleRuleDto) {
    return this.scheduleRulesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.scheduleRulesService.remove(id);
  }

  /**
   * NEW: bulk generate sessions/slots for date range (1–3 months typical)
   * POST /api/v1/schedule-rules/generate
   */
  @Post('generate')
  generate(@Body() dto: GenerateSlotsRangeDto) {
    return this.scheduleRulesService.generateSlots(dto);
  }

  /**
   * NEW: close/open whole day (holiday, leave, etc.)
   * PUT /api/v1/schedule-rules/overrides/day
   */
  @Post('overrides/day')
  upsertDayOverride(@Body() dto: UpsertDayOverrideDto) {
    return this.scheduleRulesService.upsertDayOverride(dto);
  }

  /**
   * NEW: close/edit one session on one day (e.g. only morning off)
   * PUT /api/v1/schedule-rules/overrides/session
   */
  @Post('overrides/session')
  upsertSessionOverride(@Body() dto: UpsertSessionOverrideDto) {
    return this.scheduleRulesService.upsertSessionOverride(dto);
  }
}
