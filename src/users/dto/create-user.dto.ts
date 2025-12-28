import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role; // DOCTOR | PATIENT

  @IsOptional()
  @IsString()
  provider?: string; // "google" etc.

  @IsOptional()
  @IsString()
  providerId?: string; // google profile id
}
