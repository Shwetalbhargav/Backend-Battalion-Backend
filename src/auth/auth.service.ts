import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

import { UsersService } from '../users/users.service';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';

type GoogleUserPayload = {
  email: string;
  name?: string | null;
  providerId: string;
  role?: Role;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly doctors: DoctorService,
    private readonly patients: PatientService,
  ) {}

  private normalizeRole(role?: string | Role): Role {
    if (!role) return Role.PATIENT;
    if (role === Role.DOCTOR || role === 'DOCTOR') return Role.DOCTOR;
    if (role === Role.PATIENT || role === 'PATIENT') return Role.PATIENT;
    throw new BadRequestException('Invalid role. Use DOCTOR or PATIENT.');
  }

  async googleLogin(userFromStrategy: GoogleUserPayload, roleFromQuery?: string) {
    if (!userFromStrategy?.email || !userFromStrategy?.providerId) {
      throw new BadRequestException('Google user payload missing email/providerId');
    }

    const role = this.normalizeRole(userFromStrategy.role ?? roleFromQuery);

    const user = await this.users.findOrCreateGoogleUser({
      email: userFromStrategy.email,
      name: userFromStrategy.name ?? 'Unknown',
      providerId: userFromStrategy.providerId,
      role,
    });

    if (user.role === Role.DOCTOR) {
      await this.doctors.ensureDoctorProfile(user.id);
    } else {
      await this.patients.ensurePatientProfile(user.id);
    }

    const accessToken = await this.signJwt(user);
    return { user, accessToken };
  }

  async signJwt(user: { id: number; role: Role; email: string }) {
    return this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
  }
}
