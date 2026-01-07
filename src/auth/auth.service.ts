
// src/auth/auth.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

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


  async googleLogin(user: User, role?: string) {
  // role should already be on user (set in GoogleStrategy),
  // but keep this as a fallback
  const effectiveRole =
    user.role ??
    (role?.toString().toUpperCase() === 'DOCTOR' ? Role.DOCTOR : Role.PATIENT);

  const token = await this.signJwt({
    id: user.id,
    role: effectiveRole,
    email: user.email,
  });

  return { token, user: { ...user, role: effectiveRole } };
}


  async findOrCreateGoogleUser(input: {
    email: string;
    name: string;
    provider: 'google';
    providerId: string;
    role: Role;
  }): Promise<User> {
    const { email, name, provider, providerId, role } = input;

    if (!email || !providerId) {
      throw new BadRequestException('Invalid Google profile data');
    }

    // Try to locate user either by provider+id OR by email
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ provider, providerId }, { email }],
      },
    });

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            email,
            name,
            provider,
            providerId,
            // keep existing role if already set
            role: existing.role ?? role,
          },
        })
      : await this.prisma.user.create({
          data: {
            email,
            name,
            provider,
            providerId,
            role,
          },
        });

    // Ensure role profile exists
    if (user.role === Role.DOCTOR) {
      await this.doctors.ensureDoctorProfile(user.id);
    } else {
      await this.patients.ensurePatientProfile(user.id);

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
    const numericUserId = Number(userId);
    if (role === 'DOCTOR') {
      await this.doctors.ensureDoctorProfile(numericUserId);
    } else {
      await this.patients.ensurePatientProfile(numericUserId);
    }
  }

  async signJwt(user: any) {
    return this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
  }
}
