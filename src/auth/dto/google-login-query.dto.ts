import { IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class GoogleLoginQueryDto {
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
