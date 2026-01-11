import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

type GoogleEmail = { value: string };
type GooglePhoto = { value: string };

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') ?? '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') ?? '',
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const emails = profile.emails as GoogleEmail[] | undefined;
    const photos = profile.photos as GooglePhoto[] | undefined;

    const role =
      typeof req.query?.role === 'string'
        ? req.query.role.toUpperCase()
        : undefined;

    const user = {
      provider: 'google',
      providerId: profile.id,
      email: emails?.[0]?.value ?? null,
      firstName: profile.name?.givenName ?? null,
      lastName: profile.name?.familyName ?? null,
      photo: photos?.[0]?.value ?? null,
      role,
      accessToken,
    };

    done(null, user);
  }
}
