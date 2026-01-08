import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Doctor login
   * GET /auth/doctor/google
   */
  @Get('doctor/google')
  @UseGuards(GoogleAuthGuard)
  doctorGoogleLogin(@Req() req: any) {
    // Role will be injected by the guard from req.query.role
    // We'll set it here so no query param is needed.
    req.query.role = 'DOCTOR';
    return;
  }

  /**
   * Patient login
   * GET /auth/patient/google
   */
  @Get('patient/google')
  @UseGuards(GoogleAuthGuard)
  patientGoogleLogin(@Req() req: any) {
    req.query.role = 'PATIENT';
    return;
  }

  /**
   * Shared callback
   * GET /auth/google/callback
   */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any) {
    return this.authService.googleLogin(req.user);
  }
}
