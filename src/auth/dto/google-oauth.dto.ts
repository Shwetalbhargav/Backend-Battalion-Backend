import { IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../../generated/prisma/enums';

export class GoogleOAuthDto {
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

