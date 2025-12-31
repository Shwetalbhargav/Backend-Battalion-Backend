// src/auth/google.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Role } from '@prisma/client';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
      passReqToCallback: true,
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
      const name = profile?.displayName ?? 'Unknown';
      const providerId = profile?.id;

      const rawRole = (req?.query?.state ?? 'PATIENT').toString().toUpperCase();
      const role = rawRole === 'DOCTOR' ? Role.DOCTOR : Role.PATIENT;

      const user = await this.auth.findOrCreateGoogleUser({
        email,
        name,
        providerId,
        role,
      });

      done(null, user);
    } catch (e) {
      done(e, false);
    }
  }
}
