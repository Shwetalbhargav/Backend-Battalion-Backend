import { Controller, Get, Next, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import * as passport from 'passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ✅ Link 1: Login as Doctor
  @Get('google/doctor')
  googleDoctor(@Req() req: Request, @Res() res: Response, @Next() next: any) {
    return passport.authenticate('google', {
      scope: ['email', 'profile'],
      session: false,
      state: 'DOCTOR',
    })(req, res, next);
  }

  // ✅ Link 2: Login as Patient
  @Get('google/patient')
  googlePatient(@Req() req: Request, @Res() res: Response, @Next() next: any) {
    return passport.authenticate('google', {
      scope: ['email', 'profile'],
      session: false,
      state: 'PATIENT',
    })(req, res, next);
  }

  // ✅ Single callback for BOTH
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const roleState = (req.query?.state as string) || 'PATIENT';

    const { token } = await this.authService.loginWithGoogle(req.user, roleState);

    const redirectUrl =
      process.env.FRONTEND_OAUTH_REDIRECT || 'http://localhost:3000/oauth/success';

    const url = new URL(redirectUrl);
    url.searchParams.set('token', token);

    return res.redirect(url.toString());
  }
}
