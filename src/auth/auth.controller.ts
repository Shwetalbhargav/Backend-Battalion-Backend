// src/auth/auth.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // GET /auth/google?role=DOCTOR|PATIENT
  // This triggers the Google OAuth redirect.
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(@Query('role') role?: string) {
    return { message: 'Redirecting to Google...', role: role ?? Role.PATIENT };
  }

  // GET /auth/google/callback?role=DOCTOR|PATIENT
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Query('role') role?: string) {
    // req.user is set by GoogleStrategy.validate()
    // We pass role as a fallback in case strategy didn't include it
    return this.authService.googleLogin(req.user, role);
  }
}
