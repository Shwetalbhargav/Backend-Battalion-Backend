import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserPayload {
  id: string;
  email: string;
  role: string;
  isVerified: boolean;
}

export const GetUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

