import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

function pickFirstQueryValue(value: unknown): unknown {
  // Express query values can be: string | string[] | ParsedQs | ParsedQs[] | undefined
  if (Array.isArray(value)) return value[0];
  return value;
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  override canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();

    // NOTE: keep same intent as old code (normalize from query)
    const raw = pickFirstQueryValue((req.query as Record<string, unknown>)['role']);
    const role = raw != null ? String(raw).toUpperCase() : undefined;

    // Preserve original logic: stash on request for strategy/controller to use later
    (req as unknown as { role?: string }).role = role;

    return super.canActivate(context);
  }
}
