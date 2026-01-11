import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDoctorDto {
  // We will overwrite this in controller from req.user.id
  @Type(() => Number)
  @IsInt()
  userId: number;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Optional: attach specialties at profile creation
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  specialtyIds?: number[];

  // Optional: attach services at profile creation
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  serviceIds?: number[];
}
