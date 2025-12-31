// src/auth/auth.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ✅ Start OAuth:
  // /auth/google?role=DOCTOR  OR  /auth/google?role=PATIENT
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(@Query('role') role?: string) {
    return { message: 'Redirecting to Google...', role: role ?? 'PATIENT' };
  }

  // ✅ Callback
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any) {
    const token = await this.auth.signJwt(req.user);
    return { token, user: req.user };
  }
}
