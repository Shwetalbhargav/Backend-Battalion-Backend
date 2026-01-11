import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role as AppRole } from '@prisma/client';

type AuthUser = {
  role?: AppRole;
};

type RequestWithUser = Request & {
  user?: unknown;
};

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false;
  return 'role' in value;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<AppRole[]>('roles', [
        context.getHandler(),
        context.getClass(),
      ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!isAuthUser(user)) {
      return false;
    }

    const userRole = user.role;

    if (!userRole) {
      return false;
    }

    return requiredRoles.includes(userRole);
  }
}
