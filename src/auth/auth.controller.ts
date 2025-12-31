import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from "./auth.service";

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Step 1: redirect to Google
  // Call: GET /auth/google?role=DOCTOR
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(@Query('role') role: string) {
    // passport handles redirect
    return { message: 'Redirecting to Google...', role };
  }

  // Step 2: Google callback
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any) {
    // req.user is set by GoogleStrategy.validate()
    const token = await this.auth.signJwt(req.user);
    return { token, user: req.user };
  }
}
