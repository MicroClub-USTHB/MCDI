import { SetMetadata } from '@nestjs/common';
import type { AccessResource, GrantLevel } from '../permissions/catalog';

export const ADMIN_ACCESS_KEY = 'admin_access';

export type AdminAccessRequirement =
  | { kind: 'permission'; resource: AccessResource; level: GrantLevel }
  | { kind: 'session' }
  | { kind: 'root' };

/** The endpoint needs at least `level` on `resource`. Works on a handler or a whole controller. */
export const RequirePermission = (
  resource: AccessResource,
  level: GrantLevel,
) =>
  SetMetadata<string, AdminAccessRequirement>(ADMIN_ACCESS_KEY, {
    kind: 'permission',
    resource,
    level,
  });

/** The endpoint acts on the caller's own data: any valid admin session may call it. */
export const AdminSessionOnly = () =>
  SetMetadata<string, AdminAccessRequirement>(ADMIN_ACCESS_KEY, {
    kind: 'session',
  });

/** Only root admins may call the endpoint. It is not a catalog resource, so it cannot be granted. */
export const RootOnly = () =>
  SetMetadata<string, AdminAccessRequirement>(ADMIN_ACCESS_KEY, {
    kind: 'root',
  });
