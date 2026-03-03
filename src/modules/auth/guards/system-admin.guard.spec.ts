import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { SystemAdminGuard } from './system-admin.guard';

function buildContext(
  overrides: { user?: any; headers?: Record<string, string> } = {},
): ExecutionContext {
  const req = {
    user: overrides.user ?? undefined,
    headers: overrides.headers ?? {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('SystemAdminGuard (auth)', () => {
  let guard: SystemAdminGuard;

  beforeEach(() => {
    guard = new SystemAdminGuard();
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe('development bypass', () => {
    it('returns true when NODE_ENV=development and x-dev-admin=1 header is set', () => {
      process.env.NODE_ENV = 'development';
      const ctx = buildContext({ headers: { 'x-dev-admin': '1' } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('does NOT bypass when NODE_ENV=development but header is missing', () => {
      process.env.NODE_ENV = 'development';
      expect(() => guard.canActivate(buildContext())).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('unauthenticated request', () => {
    it('throws UnauthorizedException when no user on request', () => {
      expect(() => guard.canActivate(buildContext())).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('non-admin user', () => {
    it('throws ForbiddenException when user has no system_admin role', () => {
      const ctx = buildContext({ user: { role: 'member', roles: ['member'] } });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user.roles does not include system_admin', () => {
      const ctx = buildContext({ user: { roles: ['moderator'] } });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('system admin user', () => {
    it('returns true when user.role === system_admin', () => {
      const ctx = buildContext({ user: { role: 'system_admin' } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('returns true when user.roles includes system_admin', () => {
      const ctx = buildContext({ user: { roles: ['member', 'system_admin'] } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('returns true when user.isSystemAdmin === true', () => {
      const ctx = buildContext({ user: { isSystemAdmin: true } });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
