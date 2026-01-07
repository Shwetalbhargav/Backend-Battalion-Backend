import { IsEnum, IsInt, Min } from 'class-validator';
import { BaseSessionDto, ElasticStrategy } from './common.dto';

export class UpdateCapacityDto extends BaseSessionDto {
  @IsInt()
  @Min(1)
  newCapacityPerSlot: number;

  @IsEnum(ElasticStrategy)
  strategy: ElasticStrategy; // use same strategy rules for overflow if capacity reduced
}
