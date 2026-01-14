import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async loginWithGoogle(
    googleUser: { email: string; name: string | null; providerId: string },
    stateRole: string,
  ) {
    const role: Role = stateRole === 'DOCTOR' ? Role.DOCTOR : Role.PATIENT;

    const user = await this.usersService.findOrCreateGoogleUser({
      email: googleUser.email,
      name: googleUser.name ?? '',
      providerId: googleUser.providerId,
      role,
    });

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { token, user };
  }
}
