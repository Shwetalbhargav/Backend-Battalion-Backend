import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

function getQueryValue(
  query: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = query[key];

  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : undefined;
  }

  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
}

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  override canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();

    const query = req.query as Record<string, unknown>;
    const role = getQueryValue(query, 'role');

    if (role) {
      (req as { role?: string }).role = role.toUpperCase();
    }

    return super.canActivate(context);
  }
}
