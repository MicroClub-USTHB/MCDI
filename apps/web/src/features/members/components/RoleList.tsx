'use client';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { McCard, McCardContent, McCardHeader } from '@/shared/components/ui/mc-card';
import type { MemberRole } from '@/features/members/types';

interface RoleListProps {
  roles: MemberRole[];
  serverName: string;
}

export function RoleList({ roles, serverName }: RoleListProps) {
  return (
    <McCard>
      <McCardHeader title={`Roles on ${serverName}`} />
      <McCardContent className="flex flex-wrap gap-2">
        {roles.length > 0 ? (
          roles.map((role) =>
            role.color ? (
              <McBadge
                key={role.id}
                variant="outline"
                size="md"
                className="border-transparent"
                style={{
                  color: role.color,
                  backgroundColor: `${role.color}1A`,
                }}
              >
                {role.name}
              </McBadge>
            ) : (
              <McBadge key={role.id} variant="outline" size="md">
                {role.name}
              </McBadge>
            )
          )
        ) : (
          <p className="paragraph-sm text-muted-foreground">No roles on this server.</p>
        )}
      </McCardContent>
    </McCard>
  );
}
