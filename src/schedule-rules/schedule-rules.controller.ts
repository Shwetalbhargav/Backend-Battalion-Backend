import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ScheduleRulesService } from './schedule-rules.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { ParseIntPipe } from '@nestjs/common';


@Controller('api/v1/schedule-rules')
export class ScheduleRulesController {
  constructor(private readonly service: ScheduleRulesService) {}

  @Post()
  create(@Body() dto: CreateScheduleRuleDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('doctorId') doctorId?: string) {
  return this.service.findAll(doctorId ? Number(doctorId) : undefined);
}

  // Bulk defaults endpoint
  @Post('bulk-defaults/:doctorId')
  bulkDefaults(
    @Param('doctorId', ParseIntPipe) doctorId: number,
    @Body() body: { clinicId?: number },
  ) {
    return this.service.bulkCreateDefaults(doctorId, body?.clinicId);
  }
}
