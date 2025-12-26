import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  upsertGoogleUser(data: {
    email: string;
    name?: string;
    providerId: string;
  }) {
    return this.prisma.user.upsert({
      where: { email: data.email },
      update: {
        name: data.name,
        provider: 'google',
        providerId: data.providerId,
      },
      create: {
        email: data.email,
        name: data.name,
        provider: 'google',
        providerId: data.providerId,
        role: Role.PATIENT,
      },
    });
  }
}
