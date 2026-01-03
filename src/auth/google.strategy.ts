// src/auth/google.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';

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
      passReqToCallback: true, // lets us read req.query.state in validate()
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
      const email: string | undefined = profile?.emails?.[0]?.value;
      if (!email) {
        return done(new UnauthorizedException('Google account has no email'), false);
      }

      const name: string = profile?.displayName ?? '';
      const providerId: string = profile?.id;

      // Prefer OAuth "state" (Google returns it on callback), fallback to role if present
      const raw = (req?.query?.state ?? req?.query?.role ?? 'PATIENT')
        .toString()
        .toUpperCase();

      const role: Role = raw === 'DOCTOR' ? Role.DOCTOR : Role.PATIENT;

      const user = await this.auth.findOrCreateGoogleUser({
        email,
        name,
        provider: 'google',
        providerId,
        role,
      });

      return done(null, user);
    } catch (err) {
      return done(err as any, false);
    }
  }
}
