import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ScheduleRulesService } from './schedule-rules.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { BulkScheduleRulesDto } from './dto/bulk-schedule-rules.dto';

@Controller('api/v1/schedule-rules')
export class ScheduleRulesController {
  constructor(private readonly service: ScheduleRulesService) {}

  @Post()
  create(@Body() dto: CreateScheduleRuleDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query('doctorId') doctorId: string) {
    return this.service.listByDoctor(doctorId);
  }

  /**
   * Creates default STREAM rules (MON-SAT, morning/evening)
   * POST /api/v1/schedule-rules/bulk-defaults/:doctorId
   * body: { "clinicId"?: number|string }
   */
  @Post('bulk-defaults/:doctorId')
  bulkDefaults(
    @Param('doctorId') doctorId: string,
    @Body() body: { clinicId?: number | string },
  ) {
    return this.service.bulkCreateDefaults(doctorId, body?.clinicId);
  }

  /**
   * Bulk create rules and generate availability slots in one request
   * POST /api/v1/schedule-rules/bulk
   */
  @Post('bulk')
  bulkCreateAndGenerate(@Body() dto: BulkScheduleRulesDto) {
    return this.service.bulkCreateAndGenerate(dto);
  }
}
