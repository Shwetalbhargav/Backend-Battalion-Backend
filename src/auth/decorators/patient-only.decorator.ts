import { applyDecorators, UseGuards } from '@nestjs/common';
import { PatientOnly } from "../guards/patient-only.guard";

export function RequirePatient() {
  return applyDecorators(UseGuards(PatientOnly));
}
