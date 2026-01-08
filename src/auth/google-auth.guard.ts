import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const role = (req.query.role ?? 'PATIENT').toString().toUpperCase();

    return {
      scope: ['email', 'profile'],
      state: role, // comes back as req.query.state in callback
    };
  }
}
