import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';

import { UsersModule } from '../users/users.module';
import { DoctorModule } from '../doctor/doctor.module';
import { PatientModule } from '../patient/patient.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    UsersModule,
    DoctorModule,
    PatientModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (cfg: ConfigService): JwtModuleOptions => ({
        secret: cfg.get<string>('JWT_SECRET') ?? 'dev_secret_change_me',
        signOptions: {
          // ✅ Cast to satisfy the JwtModuleOptions type
          expiresIn: (cfg.get<string>('JWT_EXPIRES_IN') ?? '7d') as any,
        },

      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get('JWT_SECRET'),
        signOptions: { expiresIn: cfg.get('JWT_EXPIRES_IN') ?? '7d' },

      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy],
})
export class AuthModule {}
