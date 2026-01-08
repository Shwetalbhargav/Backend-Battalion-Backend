import { IsInt, Max, Min } from 'class-validator';
import { BaseSessionDto } from './common.dto';

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
}
