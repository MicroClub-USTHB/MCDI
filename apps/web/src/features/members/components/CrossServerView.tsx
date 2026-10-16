'use client';

import { CalendarDays, Server } from 'lucide-react';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { McCard, McCardContent } from '@/shared/components/ui/mc-card';
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
        <Server className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 id={`cross-server-${memberId}`} className="header-xs font-bold text-foreground">
          Cross-server view
        </h2>
      </div>
      <div className="space-y-4">
        {servers.map((server) => (
          <McCard key={server.serverId}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="header-xs font-bold text-card-foreground">{server.serverName}</h3>
              {server.isMainServer ? <McBadge variant="default">Main server</McBadge> : null}
            </div>
            <McCardContent className="space-y-4">
              <p className="flex items-center gap-2 paragraph-sm text-muted-foreground">
                <CalendarDays className="size-4" aria-hidden="true" />
                Joined {formatJoinedAt(server.joinedAt)}
              </p>
              <RoleList roles={server.roles} serverName={server.serverName} />
            </McCardContent>
          </McCard>
        ))}
        {servers.length === 0 ? (
          <McCard>
            <McCardContent className="py-4 paragraph-sm text-muted-foreground">
              No server memberships found.
            </McCardContent>
          </McCard>
        ) : null}
      </div>
    </section>
  );
}
