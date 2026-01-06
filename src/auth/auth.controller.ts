import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto, SigninDto } from './dto/register.dto';
import { GoogleOAuthDto } from './dto/google-oauth.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { GetUser, UserPayload } from './decorators/get-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    return await this.authService.signup(signupDto);
  }

  @Post('signin')
  async signin(@Body() signinDto: SigninDto) {
    return await this.authService.signin(signinDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@GetUser() user: UserPayload) {
    return {
      message: 'This is a protected route',
      user,
    };
  }

  @Post('signout')
  @UseGuards(JwtAuthGuard)
  async signout(@GetUser() user: UserPayload) {
    // JWT tokens are stateless, so signout is primarily client-side
    // This endpoint confirms the user was authenticated and provides a clean way to sign out
    return {
      message: 'Successfully signed out',
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth(@Query('role') role?: string) {
    // This route initiates Google OAuth flow
    // Passport handles the redirect to Google
    // Role can be passed as query parameter and stored in session/state
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const googleUser = req.user as any;
    // Role is now extracted from state parameter in the strategy
    const role = googleUser.role;

    try {
      const result = await this.authService.validateGoogleUser(
        googleUser,
        role ? (role as any) : undefined,
      );

      // Check if client wants JSON response (for API testing)
      // Default to JSON for API testing unless redirect is explicitly requested
      const acceptHeader = req.headers.accept || '';
      const wantsRedirect = req.query.redirect === 'true' || req.query.redirect === '1';
      const wantsJson = 
        req.query.format === 'json' || 
        acceptHeader.includes('application/json') || 
        (!wantsRedirect && !acceptHeader.includes('text/html'));

      if (wantsJson) {
        // Return JSON response (for API clients/testing)
        return res.json({
          message: 'Google OAuth authentication successful',
          ...result,
        });
      }

      // Redirect to frontend with token (for web apps)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      // Ensure we use absolute URL - construct full URL properly
      let redirectUrl: string;
      if (frontendUrl.startsWith('http://') || frontendUrl.startsWith('https://')) {
        redirectUrl = `${frontendUrl}/auth/callback?token=${result.access_token}`;
      } else {
        // If no protocol, assume http for localhost
        redirectUrl = `http://${frontendUrl}/auth/callback?token=${result.access_token}`;
      }
      
      return res.redirect(302, redirectUrl);
    } catch (error: any) {
      // Check if client wants JSON response
      const acceptHeader = req.headers.accept || '';
      const wantsRedirect = req.query.redirect === 'true' || req.query.redirect === '1';
      const wantsJson = 
        req.query.format === 'json' || 
        acceptHeader.includes('application/json') || 
        (!wantsRedirect && !acceptHeader.includes('text/html'));

      if (wantsJson) {
        return res.status(401).json({
          message: 'Google OAuth authentication failed',
          error: error.message || 'Authentication failed',
        });
      }

      // Redirect to frontend error page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      let errorUrl: string;
      if (frontendUrl.startsWith('http://') || frontendUrl.startsWith('https://')) {
        errorUrl = `${frontendUrl}/auth/error?message=${encodeURIComponent(error.message || 'Authentication failed')}`;
      } else {
        errorUrl = `http://${frontendUrl}/auth/error?message=${encodeURIComponent(error.message || 'Authentication failed')}`;
      }
      
      return res.redirect(302, errorUrl);
    }
  }
}
