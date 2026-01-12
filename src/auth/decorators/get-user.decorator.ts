import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserPayload {
  id: string;
  email: string;
  role: string;
  isVerified: boolean;
}

type RequestWithUser = {
  user?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const GetUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user: unknown = request.user;

    if (!data) return user;

    if (!isRecord(user)) return undefined;

    return user[data as string];
  },
);
