import { applyDecorators, UseGuards } from '@nestjs/common';
import { Roles } from '../roles.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

export const PatientOnly = () =>
  applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles('PATIENT'));
