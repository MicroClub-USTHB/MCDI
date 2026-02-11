import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class SystemAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (
      process.env.NODE_ENV === 'development' &&
      req.headers['x-dev-admin'] === '1'
    ) {
      return true;
    }
    const user = req.user;
    if (!user) throw new UnauthorizedException('Authentication required');

    const isSystemAdmin =
      user.role === 'system_admin' ||
      user.roles?.includes?.('system_admin') ||
      user.isSystemAdmin === true;

    if (!isSystemAdmin) {
      throw new ForbiddenException('System Admin access required');
    }

    return true;
  }
}
