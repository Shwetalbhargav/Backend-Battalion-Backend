import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DoctorModule } from '../doctor/doctor.module';
import { PatientModule } from '../patient/patient.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule, // ✅ REQUIRED
    JwtModule.registerAsync({
      imports: [ConfigModule], // ✅ REQUIRED
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') ?? 'secret';

        const expiresIn =
          (configService.get<string>('JWT_EXPIRES_IN') as StringValue | undefined) ??
          ('1d' as StringValue);

        return {
          secret,
          signOptions: { expiresIn },
        };
      },
    }),
    forwardRef(() => DoctorModule),
    PatientModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule], // ✅ export JwtModule if other modules need it
})
export class AuthModule {}
