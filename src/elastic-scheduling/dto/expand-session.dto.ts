import { IsInt, IsOptional, Max, Min , IsEnum} from 'class-validator';
import { BaseSessionDto } from './common.dto';
import { SchedulingStrategy } from '@prisma/client';


export class ExpandSessionDto extends BaseSessionDto {
  // minutes since midnight (0..1440)
  @IsInt()
  @Min(0)
  @Max(1440)
  newStartMinute: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  newEndMinute: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  bufferMinutes?: number;

  @IsOptional()
  @IsEnum(SchedulingStrategy)
  strategy?: SchedulingStrategy;
}


