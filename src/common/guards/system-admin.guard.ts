import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Placeholder guard for System Admin authorization.
 * TODO: Implement actual admin check once auth (sessions / JWT) is wired up.
 * For now it lets every request through so the endpoints are testable.
 */
@Injectable()
export class SystemAdminGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // TODO: validate session/token and check admin role
    return true;
  }
}
