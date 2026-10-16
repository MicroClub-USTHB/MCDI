'use client';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { McCard, McCardContent } from '@/shared/components/ui/mc-card';
import type { MemberPermissionsDto } from '@/features/members/types';

interface MemberPermissionsPanelProps {
  permissionsByServer: Array<{
    serverId: string;
    serverName: string;
    permissions: MemberPermissionsDto | null;
  }>;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return '';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function PermissionTree({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={index} className="rounded-md border border-border bg-background p-3">
            <PermissionTree value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    return (
      <div className="space-y-2">
        {entries.map(([key, item]) => (
          <div key={key} className="rounded-md border border-border bg-background p-3">
            <div className="mb-2 paragraph-xs font-semibold tracking-wide text-muted-foreground">
              {key}
            </div>
            <PermissionTree value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return value ? (
      <McBadge variant="outline" className="border-success/30 bg-success/10 text-success">
        Allowed
      </McBadge>
    ) : (
      <McBadge variant="destructive">Denied</McBadge>
    );
  }

  const formattedValue = formatValue(value);

  if (formattedValue === '') {
    return <span className="paragraph-sm text-muted-foreground">Unsupported value</span>;
  }

  return <span className="paragraph-sm text-foreground">{formattedValue}</span>;
}

export function MemberPermissionsPanel({ permissionsByServer }: MemberPermissionsPanelProps) {
  return (
    <section className="space-y-4" aria-label="Member permissions">
      <h2 className="header-xs font-bold text-foreground">Resolved permissions</h2>
      <div className="space-y-4">
        {permissionsByServer.map((server) => (
          <McCard key={server.serverId}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="header-xs font-bold text-card-foreground">{server.serverName}</h3>
              {server.permissions ? (
                <span className="paragraph-xs font-semibold tracking-wide text-muted-foreground">
                  {server.permissions.permissions.length} permission
                  {server.permissions.permissions.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
            <McCardContent className="space-y-4">
              {server.permissions ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="paragraph-sm text-muted-foreground">
                      Discord ID: {server.permissions.discordId}
                    </p>
                    <p className="paragraph-sm text-muted-foreground">
                      Server ID: {server.permissions.serverId}
                    </p>
                  </div>
                  {server.permissions.permissions.length > 0 ? (
                    <PermissionTree value={server.permissions} />
                  ) : (
                    <p className="paragraph-sm text-muted-foreground">No permissions returned.</p>
                  )}
                </div>
              ) : (
                <p className="paragraph-sm text-muted-foreground">No permissions data returned.</p>
              )}
            </McCardContent>
          </McCard>
        ))}
      </div>
    </section>
  );
}
