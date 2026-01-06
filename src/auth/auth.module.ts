import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from './guards/jwt.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): any => {
        const secret = configService.get<string>('JWT_SECRET') || 'my-secret123456';
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') || '24h';
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    GoogleOAuthGuard,
    // Conditionally register GoogleStrategy only if credentials are available
    {
      provide: GoogleStrategy,
      useFactory: (configService: ConfigService, authService: AuthService) => {
        const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
        const logger = new Logger('AuthModule');

        if (clientID && clientSecret) {
          try {
            return new GoogleStrategy(configService, authService);
          } catch (error) {
            logger.error('Failed to initialize Google OAuth Strategy', error);
            return null;
          }
        } else {
          logger.warn(
            'Google OAuth credentials not found. Google OAuth will be disabled. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable.',
          );
          return null;
        }
      },
      inject: [ConfigService, AuthService],
    },
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
