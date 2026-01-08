import { Role } from '@prisma/client';

export class AuthUserDto {
  id: number;
  email: string;
  role: Role;
  name?: string | null;
}
