// src/auth/auth.controller.ts
import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Frontend calls: /auth/google?role=DOCTOR or PATIENT
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(@Query('role') role: string) {
    return { message: 'Redirecting to Google...', role };
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any) {
    const token = await this.authService.signJwt(req.user);
    return {
      token,
      user: req.user,
    };
  }
}
