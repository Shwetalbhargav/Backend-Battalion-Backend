import { IsOptional, IsString } from 'class-validator';

export class BulkDefaultsDto {
  @IsOptional()
  @IsString()
  clinicId?: string; // used for OFFLINE defaults
}
