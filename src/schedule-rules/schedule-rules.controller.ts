import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ScheduleRulesService } from './schedule-rules.service';

import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';
import { BulkScheduleRulesDto } from './dto/bulk-schedule-rules.dto';

import { GenerateSlotsRangeDto } from './dto/generate-slots-range.dto';
import { UpsertDayOverrideDto } from './dto/upsert-day-override.dto';
import { UpsertSessionOverrideDto } from './dto/upsert-session-override.dto';

@Controller('schedule-rules')
export class ScheduleRulesController {
  constructor(private readonly scheduleRulesService: ScheduleRulesService) {}

  /**
   * Create a single schedule rule
   */
  @Post()
  create(@Body() dto: CreateScheduleRuleDto) {
    return this.scheduleRulesService.create(dto);
  }

  /**
   * List schedule rules
   * GET /schedule-rules?doctorId=1&clinicId=2&meetingType=ONLINE
   */
  @Get()
  findAll(
    @Query('doctorId') doctorId?: string,
    @Query('clinicId') clinicId?: string,
    @Query('meetingType') meetingType?: string,
  ) {
    return this.scheduleRulesService.findAll({
      doctorId,
      clinicId,
      meetingType,
    });
  }

  /**
   * Get one rule by id
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.scheduleRulesService.findOne(id);
  }

  /**
   * Update rule by id
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleRuleDto,
  ) {
    return this.scheduleRulesService.update(id, dto);
  }

  /**
   * Delete rule by id
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.scheduleRulesService.remove(id);
  }

  /**
   * Bulk create default rules (no slot generation)
   * POST /schedule-rules/bulk-defaults
   */
  @Post('bulk-defaults')
  bulkCreateDefaults(@Body() dto: BulkScheduleRulesDto) {
    return this.scheduleRulesService.bulkCreateDefaultRules(dto);
  }

  /**
   * Bulk create rules and generate availability slots in one request
   * POST /schedule-rules/bulk
   */
  @Post('bulk')
  bulkCreateAndGenerate(@Body() dto: BulkScheduleRulesDto) {
    return this.scheduleRulesService.bulkCreateAndGenerate(dto);
  }

  /**
   * Generate slots for a doctor in a date range
   * POST /schedule-rules/generate-slots
   */
  @Post('generate-slots')
  generateSlots(@Body() dto: GenerateSlotsRangeDto) {
    return this.scheduleRulesService.generateSlotsForRange(dto);
  }

  /**
   * Upsert a day override
   * POST /schedule-rules/day-override
   */
  @Post('day-override')
  upsertDayOverride(@Body() dto: UpsertDayOverrideDto) {
    return this.scheduleRulesService.upsertDayOverride(dto);
  }

  /**
   * Upsert a session override
   * POST /schedule-rules/session-override
   */
  @Post('session-override')
  upsertSessionOverride(@Body() dto: UpsertSessionOverrideDto) {
    return this.scheduleRulesService.upsertSessionOverride(dto);
  }
}
