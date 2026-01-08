import { IsEnum, IsOptional } from 'class-validator';
import { Role as UserRole } from '@prisma/client';

export class GoogleOAuthDto {
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
