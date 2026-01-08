import { applyDecorators, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from "../decorators/roles.decorator";

export const DoctorOnly = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(Role.DOCTOR),
  );
