import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly cfg: ConfigService) {
    super({
      clientID: cfg.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: cfg.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: cfg.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    try {
      const email = profile?.emails?.[0]?.value;
      const name = profile?.displayName ?? null;
      const providerId = profile?.id;

      const rawRole = (req?.query?.state ?? req?.query?.role ?? 'PATIENT').toString().toUpperCase();
      const role = rawRole === 'DOCTOR' ? Role.DOCTOR : Role.PATIENT;

      // We do NOT create DB user here; AuthService will handle it in callback.
      const payload = { email, name, providerId, role };

      return done(null, payload);
    } catch (err) {
      return done(err as any, false);
    }
  }
}
