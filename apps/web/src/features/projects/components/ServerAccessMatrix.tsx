'use client';

import type { ServerListItemDto } from '@/features/servers/types';
import type {
  AccessMatrixEntry,
  AccessOperations,
  ProjectOperation,
  ProjectScope,
} from '@/features/projects/types';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Switch } from '@/shared/components/ui/switch';
import { useCan } from '@/shared/lib/use-access';

const PROJECT_SCOPES: readonly ProjectScope[] = ['read_members', 'check_permissions'];
const PROJECT_OPERATIONS: readonly ProjectOperation[] = [
  'READ',
  'SEND_MESSAGES',
  'MANAGE_WEBHOOKS',
];

const OPERATION_LABELS: Record<ProjectOperation, string> = {
  READ: 'Read',
  SEND_MESSAGES: 'Send messages',
  MANAGE_WEBHOOKS: 'Manage webhooks',
};

const SCOPE_LABELS: Record<ProjectScope, string> = {
  read_members: 'Read members',
  check_permissions: 'Check permissions',
};

export interface ServerAccessChange {
  revoke?: boolean;
  operations?: AccessOperations;
  scopes?: ProjectScope[];
}

interface ServerAccessMatrixProps {
  projectId: string;
  /** All servers — granted state comes from `accessMap`, not this list. */
  servers: ServerListItemDto[];
  /** Existing grants keyed by server id. */
  accessMap: Record<string, AccessMatrixEntry>;
  /** True while a grant/update/revoke is in flight — every control is disabled. */
  isMutating?: boolean;
  onChange: (serverId: string, change: ServerAccessChange) => void;
}

const DEFAULT_OPERATIONS: AccessOperations = {
  READ: true,
  SEND_MESSAGES: false,
  MANAGE_WEBHOOKS: false,
};

/**
 * Per-server operations editor. Each server's grant is toggled here; the
 * backend has no "grant without operations" concept, so granting defaults to
 * READ on and all scopes, and individual toggles persist through `PUT
 * /admin/projects/:id/servers/:serverId` (see the parent view's handler).
 */
function ServerAccessMatrix({
  projectId: _projectId,
  servers,
  accessMap,
  isMutating = false,
  onChange,
}: ServerAccessMatrixProps) {
  const canWrite = useCan('projects', 'write');
  const canManage = useCan('projects', 'manage');

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <thead className="bg-surface-raised">
          <tr>
            <th scope="col" className="px-4 py-3 text-overline text-text-subtle">
              Server
            </th>
            <th scope="col" className="px-4 py-3 text-overline text-text-subtle">
              Scopes
            </th>
            {PROJECT_OPERATIONS.map((operation) => (
              <th key={operation} scope="col" className="px-4 py-3 text-overline text-text-subtle">
                {OPERATION_LABELS[operation]}
              </th>
            ))}
            <th scope="col" className="px-4 py-3 text-right text-overline text-text-subtle">
              Access
            </th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => {
            const entry = accessMap[server.id];
            const granted = entry !== undefined;
            const scopes = entry?.scopes ?? [];
            const operations = entry?.operations;

            function toggleScope(scope: ProjectScope) {
              if (!granted || !operations) return;
              const nextScopes = scopes.includes(scope)
                ? scopes.filter((s) => s !== scope)
                : [...scopes, scope];
              onChange(server.id, { operations, scopes: nextScopes });
            }

            function toggleOperation(operation: ProjectOperation) {
              if (!granted || !operations) return;
              onChange(server.id, {
                operations: { ...operations, [operation]: !operations[operation] },
                scopes,
              });
            }

            function toggleGrant() {
              if (granted) {
                onChange(server.id, { revoke: true });
              } else {
                onChange(server.id, {
                  operations: { ...DEFAULT_OPERATIONS },
                  scopes: [...PROJECT_SCOPES],
                });
              }
            }

            return (
              <tr
                key={server.id}
                className="border-b border-border transition-colors last:border-b-0 hover:bg-surface-hover"
              >
                <td className="px-4 py-3 text-body text-text-normal">{server.name}</td>
                <td className="px-4 py-3">
                  {granted ? (
                    <div className="flex flex-col gap-1.5">
                      {PROJECT_SCOPES.map((scope) => (
                        <label key={scope} className="flex cursor-pointer items-center gap-2">
                          <Checkbox
                            checked={scopes.includes(scope)}
                            disabled={isMutating || !canWrite}
                            onCheckedChange={() => toggleScope(scope)}
                            aria-label={`${SCOPE_LABELS[scope]} on ${server.name}`}
                          />
                          <span className="text-overline text-text-subtle">
                            {SCOPE_LABELS[scope]}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="text-overline text-text-faint">No access</span>
                  )}
                </td>
                {PROJECT_OPERATIONS.map((operation) => (
                  <td key={operation} className="px-4 py-3">
                    <Checkbox
                      checked={granted ? (operations?.[operation] ?? false) : false}
                      disabled={isMutating || !canWrite || !granted}
                      onCheckedChange={() => toggleOperation(operation)}
                      aria-label={`${OPERATION_LABELS[operation]} on ${server.name}`}
                    />
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  {(granted ? canManage : canWrite) && (
                    <Switch
                      checked={granted}
                      disabled={isMutating || !server.isActive}
                      onCheckedChange={toggleGrant}
                      aria-label={
                        granted
                          ? `Revoke access for ${server.name}`
                          : `Grant access to ${server.name}`
                      }
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { ServerAccessMatrix, type ServerAccessMatrixProps };
