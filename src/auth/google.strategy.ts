import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from "./auth.service";

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
      passReqToCallback: true, // so we can read req.query/state
    });
  }

  // This runs before redirect: we can add state
  authorizationParams(req: any) {
    // Role comes from /auth/google?role=DOCTOR
    const role = (req?.query?.role || '').toString().toUpperCase();
    // put it into OAuth "state"
    return role ? { state: role } : {};
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
      const name = profile?.displayName ?? '';
      const providerId = profile?.id;

      if (!email || !providerId) {
        throw new UnauthorizedException('Google profile missing email/id');
      }

      // role from state; default fallback
      const roleFromState = (req?.query?.state || '').toString().toUpperCase();
      const role = roleFromState === 'DOCTOR' || roleFromState === 'PATIENT'
        ? roleFromState
        : 'PATIENT';

      const user = await this.auth.findOrCreateGoogleUser({
        email,
        name,
        
        providerId,
        role,
      });

      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
}
