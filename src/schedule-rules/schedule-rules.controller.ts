import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ScheduleRulesService } from './schedule-rules.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';

@Controller('api/v1/schedule-rules')
export class ScheduleRulesController {
  constructor(private readonly scheduleRulesService: ScheduleRulesService) { }

  @Post()
  create(@Body() dto: CreateScheduleRuleDto) {
    return this.scheduleRulesService.create(dto);
  }

  // Optional filter: /api/v1/schedule-rules?doctorId=1
  @Get()
  findAll(@Query('doctorId') doctorId?: string) {
    return this.scheduleRulesService.findAll({ doctorId });
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
}
