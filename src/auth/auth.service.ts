// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly doctors: DoctorService,
    private readonly patients: PatientService,
  ) {}

  async findOrCreateGoogleUser(input: {
    email: string;
    name: string;
    provider: 'GOOGLE';
    providerId: string;
    role: Role;
  }) {
    const user = await this.users.findOrCreateGoogleUser(input);

    // ✅ Ensure numeric id (some implementations return string)
    const userId = Number((user as any).id);

    if (Number.isNaN(userId)) {
      // If this happens, your UsersService is returning a bad shape
      throw new Error('User id is not a valid number');
    }

    if (input.role === Role.DOCTOR) {
      await this.doctors.ensureDoctorProfile(userId);
    } else {
      await this.patients.ensurePatientProfile(userId);
    }

    return {
      id: userId,
      email: (user as any).email,
      role: (user as any).role,
      name: (user as any).name,
    };
  }

  async signJwt(user: { id: number; role: Role; email: string }) {
    return this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
  }
}
