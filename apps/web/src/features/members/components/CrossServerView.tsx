'use client';

import { CalendarDays, Server } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { RoleList } from './RoleList';
import type { MemberServerDetail } from '@/features/members/types';

interface CrossServerViewProps {
  memberId: string;
  servers: MemberServerDetail[];
}

function formatJoinedAt(joinedAt: string | null): string {
  if (!joinedAt) return 'Join date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(joinedAt));
}

export function CrossServerView({ memberId, servers }: CrossServerViewProps) {
  return (
    <section className="space-y-4" aria-labelledby={`cross-server-${memberId}`}>
      <div className="flex items-center gap-2">
        <Server className="size-4 text-text-muted" aria-hidden="true" />
        <h2 id={`cross-server-${memberId}`} className="text-heading text-text-primary">
          Cross-server view
        </h2>
      </div>
      <div className="space-y-4">
        {servers.map((server) => (
          <Card key={server.serverId}>
            <CardHeader className="pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{server.serverName}</CardTitle>
                {server.isMainServer ? <Badge variant="brand">Main server</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="flex items-center gap-2 text-body text-text-muted">
                <CalendarDays className="size-4" aria-hidden="true" />
                Joined {formatJoinedAt(server.joinedAt)}
              </p>
              <RoleList roles={server.roles} serverName={server.serverName} />
            </CardContent>
          </Card>
        ))}
        {servers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-body text-text-muted">
              No server memberships found.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
