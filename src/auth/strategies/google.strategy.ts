import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL') || '/api/v1/auth/google/callback';

    if (!clientID || !clientSecret) {
      throw new Error(
        'Google OAuth credentials are missing. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: true, // Enable passing request to validate method
    });

    this.logger.log('Google OAuth Strategy initialized');
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const email = emails[0]?.value;
    const firstName = name?.givenName;
    const lastName = name?.familyName;
    const picture = photos[0]?.value;

    // Extract role from state parameter (passed during OAuth initiation)
    const state = req.query?.state as string;
    const role = state ? state.split(':')[1] : undefined;

    const user = {
      googleId: id,
      email,
      firstName,
      lastName,
      picture,
      accessToken,
      role, // Include role in user object
    };

    done(null, user);
  }
}

