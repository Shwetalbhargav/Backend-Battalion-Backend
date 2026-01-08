import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  } from 'class-validator';
import { Role as UserRole } from '@prisma/client';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  role: UserRole = UserRole.PATIENT;
}

export class SigninDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
