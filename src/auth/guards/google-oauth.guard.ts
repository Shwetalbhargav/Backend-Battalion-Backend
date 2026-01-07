import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const clientID = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientID || !clientSecret) {
      throw new UnauthorizedException(
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.',
      );
    }

    const request = context.switchToHttp().getRequest();
    const role = request.query?.role;

    // If role is provided, pass it through state parameter
    if (role) {
      // Store role in state parameter to preserve it through OAuth flow
      request.query.state = `role:${role}`;
    }

    return super.canActivate(context);
  }
}

