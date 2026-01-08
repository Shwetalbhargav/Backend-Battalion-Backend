import { Body, Controller, Post } from '@nestjs/common';
import { ElasticSchedulingService } from './elastic-scheduling.service';
import { ExpandSessionDto } from './dto/expand-session.dto';
import { ShrinkSessionDto } from './dto/shrink-session.dto';
import { UpdateCapacityDto } from './dto/update-capacity.dto';

@Controller('api/v1/elastic-scheduling')
export class ElasticSchedulingController {
  constructor(private readonly service: ElasticSchedulingService) {}

  /**
   * Iteration 1: Expand session (safe)
   * POST /api/v1/elastic-scheduling/session/expand
   */
  @Post('session/expand')
  expandSession(@Body() dto: ExpandSessionDto) {
    return this.service.expandSession(dto);
  }

  /**
   * Iteration 2 + Iteration 4: Shrink session (WAVE / STREAM)
   * POST /api/v1/elastic-scheduling/session/shrink
   */
  @Post('session/shrink')
  shrinkSession(@Body() dto: ShrinkSessionDto) {
    return this.service.shrinkSession(dto);
  }

  /**
   * Iteration 3: Capacity +/- for active session (WAVE / STREAM)
   * POST /api/v1/elastic-scheduling/session/capacity
   */
  @Post('session/capacity')
  updateCapacity(@Body() dto: UpdateCapacityDto) {
    return this.service.updateCapacity(dto);
  }
}
