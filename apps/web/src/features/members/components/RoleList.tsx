'use client';

import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { MemberRole } from '@/features/members/types';

interface RoleListProps {
  roles: MemberRole[];
  serverName: string;
}

export function RoleList({ roles, serverName }: RoleListProps) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>Roles on {serverName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {roles.length > 0 ? (
          roles.map((role) =>
            role.color ? (
              <Badge
                key={role.id}
                variant="outline"
                className="border-transparent text-body"
                style={{
                  color: role.color,
                  backgroundColor: `${role.color}1A`,
                }}
              >
                {role.name}
              </Badge>
            ) : (
              <Badge key={role.id} variant="secondary">
                {role.name}
              </Badge>
            )
          )
        ) : (
          <p className="text-body text-text-muted">No roles on this server.</p>
        )}
      </CardContent>
    </Card>
  );
}
