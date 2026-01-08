import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Role } from '@prisma/client';

import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
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
      const providerId = profile?.id;
      const name = profile?.displayName;

      if (!email || !providerId) {
        throw new UnauthorizedException('Invalid Google profile');
      }

      const rawRole = (req?.query?.state ?? 'PATIENT')
        .toString()
        .toUpperCase();

      const role: Role =
        rawRole === 'DOCTOR' ? Role.DOCTOR : Role.PATIENT;

      const user = await this.auth.findOrCreateGoogleUser({
        email,
        name,
        providerId,
        role,
      });

      return done(null, user);
    } catch (err) {
      return done(err as any, false);
    }
  }
}
