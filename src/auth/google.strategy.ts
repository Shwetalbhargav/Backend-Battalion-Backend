// src/auth/google.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Role } from '@prisma/client';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      passReqToCallback: true, // ✅ REQUIRED
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    try {
      const email = profile?.emails?.[0]?.value;
      const name = profile?.displayName;
      const providerId = profile?.id;

      if (!email || !providerId) {
        throw new UnauthorizedException('Invalid Google profile');
      }

      // ✅ ROLE HANDLING (Doctor or Patient)
      const rawRole = (req?.query?.role ?? 'PATIENT').toString().toUpperCase();
      const role = rawRole === 'DOCTOR' ? Role.DOCTOR : Role.PATIENT;

      const user = await this.authService.findOrCreateGoogleUser({
        email,
        name,
        provider: 'GOOGLE',
        providerId,
        role,
      });

      // IMPORTANT: this object becomes req.user
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
}
