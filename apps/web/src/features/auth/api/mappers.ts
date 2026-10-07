import type { User } from '@/shared/types';
import type { AdminProfileDto } from '@/features/auth/types';

export function mapAdminProfileToUser(dto: AdminProfileDto): User {
  return {
    id: dto.id,
    username: dto.username,
    name: dto.displayName || dto.globalName || dto.username,
    email: dto.email,
    avatar: dto.avatar,
    isSystemAdmin: dto.isSystemAdmin,
    root: dto.root,
    permissions: dto.permissions,
  };
}
