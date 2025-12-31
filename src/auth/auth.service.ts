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
    providerId: string;
    role: Role;
  }) {
    const user = await this.users.findOrCreateGoogleUser(input);

    // ✅ create doctor/patient profile row if missing
    if (user.role === Role.DOCTOR) {
      await this.doctors.ensureDoctorProfile(user.id);
    } else {
      await this.patients.ensurePatientProfile(user.id);
    }

    return user;
  }

  async signJwt(user: { id: number; role: Role; email: string }) {
    return this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
  }
}
