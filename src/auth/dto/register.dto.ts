import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { UserRole, AuthMethod } from '../../../generated/prisma/enums';

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