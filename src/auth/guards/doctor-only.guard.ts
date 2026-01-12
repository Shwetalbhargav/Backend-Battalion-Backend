import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class DoctorOnly implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    if (!req.user) {
      throw new UnauthorizedException('Missing authentication');
    }

    if (req.user.role !== Role.DOCTOR) {
      throw new ForbiddenException('Doctor access only');
    }

    return true;
  }
}
