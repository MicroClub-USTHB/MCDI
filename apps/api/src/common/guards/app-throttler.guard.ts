import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

const SKIP_GLOBAL_THROTTLE = 'skip_global_throttle';

/**
 * Opt a route out of the global IP-keyed limit. Use it when the route already
 * rate-limits itself some other way (`ProjectThrottlerGuard`, the inbound
 * webhook's Redis limit) or must never be limited (health check). Unlike
 * `@SkipThrottle()`, it leaves route-level throttler guards untouched.
 */
export const SkipGlobalThrottle = () => SetMetadata(SKIP_GLOBAL_THROTTLE, true);

/**
 * Registered as the global guard, so `THROTTLER_TTL_MS` / `THROTTLER_LIMIT`
 * are the default limit. A route's `@Throttle({ default })` overrides them.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(
      this.reflector.getAllAndOverride<boolean>(SKIP_GLOBAL_THROTTLE, [
        context.getHandler(),
        context.getClass(),
      ]) === true,
    );
  }
}
