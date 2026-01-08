import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly doctors: DoctorService,
    private readonly patients: PatientService,
  ) {}

  async findOrCreateGoogleUser(input: {
    email: string;
    name?: string;
    providerId: string;
    role: Role;
  }): Promise<User> {
    const { email, name, providerId, role } = input;

    if (!email || !providerId) {
      throw new BadRequestException('Invalid Google profile');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { provider: 'google', providerId },
          { email },
        ],
      },
    });

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            name,
            provider: 'google',
            providerId,
            // keep existing role if already set
            role: existing.role ?? role,
          },
        })
      : await this.prisma.user.create({
          data: {
            email,
            name,
            provider: 'google',
            providerId,
            role,
          },
        });

    await this.ensureRoleProfile(user.id, user.role);
    return user;
  }

  private async ensureRoleProfile(userId: number, role: Role) {
    if (role === Role.DOCTOR) {
      await this.doctors.ensureDoctorProfile(userId);
    } else {
      await this.patients.ensurePatientProfile(userId);
    }
  }

  async signJwt(user: Pick<User, 'id' | 'email' | 'role'>) {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async googleLogin(user: User) {
    return {
      token: await this.signJwt(user),
      user,
    };
  }
}
