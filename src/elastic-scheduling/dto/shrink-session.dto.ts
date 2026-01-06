import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { BaseSessionDto, ElasticStrategy } from './common.dto';

export class ShrinkSessionDto extends BaseSessionDto {
  @IsInt()
  @Min(0)
  @Max(1440)
  newStartMinute: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  newEndMinute: number;

  @IsEnum(ElasticStrategy)
  strategy: ElasticStrategy; // WAVE or STREAM
}
