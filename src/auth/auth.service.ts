import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { Role } from '@prisma/client';

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
    name?: string | null;
    providerId: string;
    role: Role; // 'DOCTOR' | 'PATIENT'
  }) {
    // 1) already linked to google?
    const byProvider = await this.users.findByProvider('google', payload.providerId);
    if (byProvider) {
      await this.ensureProfile(byProvider.id, byProvider.role);
      return byProvider;
    }

    // 2) existing email? link google
    const byEmail = await this.users.findByEmail(payload.email);
    if (byEmail) {
      const linked = await this.users.linkGoogle(byEmail.id, payload.providerId); // ✅ number
      await this.ensureProfile(linked.id, linked.role);
      return linked;
    }

    // 3) create new user
    const created = await this.users.create({
      email: payload.email,
      name: payload.name ?? null,
      role: payload.role,
      provider: 'google',
      providerId: payload.providerId,
    } as any);

    await this.ensureProfile(created.id, created.role);
    return created;
  }

  private async ensureProfile(userId: number, role: Role) {
    if (role === 'DOCTOR') {
      await this.doctors.ensureDoctorProfile(userId); // ✅ number
    } else {
      await this.patients.ensurePatientProfile(userId); // ✅ number
    }
  }

  async signJwt(user: { id: number; role: Role; email: string }) {
    return this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
  }
}
