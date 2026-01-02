

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

  async findOrCreateGoogleUser(payload: {
    email: string;
    name: string;
    provider: 'GOOGLE';
    providerId: string;
    role: 'DOCTOR' | 'PATIENT';
  }) {
    // 1) find by providerId (best)
    const byProvider = await this.users.findByProvider(
      payload.provider,
      payload.providerId,
    );
    if (byProvider) return byProvider;

    // 2) find by email (link old account)
    const byEmail = await this.users.findByEmail(payload.email);
    if (byEmail) {
      return this.users.linkGoogle(byEmail.id, payload.providerId);
    }

    // 3) create new
    return this.users.create({
      email: payload.email,
      name: payload.name,
      role: payload.role,
      provider: payload.provider,
      providerId: payload.providerId,
    });
  }

  async ensureProfileForRole(userId: string, role: 'DOCTOR' | 'PATIENT') {
    if (role === 'DOCTOR') {
      await this.doctors.ensureDoctorProfile(userId);
    } else {
      await this.patients.ensurePatientProfile(userId);
    }
  }

  async signJwt(user: any) {
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
