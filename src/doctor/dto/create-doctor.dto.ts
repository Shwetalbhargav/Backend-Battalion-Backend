import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @IsOptional()
  @IsString()
  bio?: string;
}
