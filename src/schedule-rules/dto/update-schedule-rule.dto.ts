import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduleRuleDto } from './create-schedule-rule.dto';

export class UpdateScheduleRuleDto extends PartialType(CreateScheduleRuleDto) {}
