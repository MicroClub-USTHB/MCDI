import { cn } from '@/shared/lib/utils';
import type { CrossServerListItemDto } from '@/features/members/types';
import type {
  AuditActionType,
  AuditLogFilters as AuditLogFilterState,
  AuditSeverity,
} from '@/features/monitoring/types';

interface AuditLogFiltersProps {
  filters: AuditLogFilterState;
  onChange: (filters: AuditLogFilterState) => void;
  actors?: CrossServerListItemDto[];
  /** The actor list needs `members:read`; without it the filter is not offered. */
  showActorFilter?: boolean;
}

const ACTIONS: Array<{ value: AuditActionType; label: string }> = [
  { value: 'auth', label: 'Auth' },
  { value: 'project', label: 'Project' },
  { value: 'server', label: 'Server' },
  { value: 'role', label: 'Role' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'member', label: 'Member' },
  { value: 'sync', label: 'Sync' },
  { value: 'permission', label: 'Permission' },
  { value: 'access', label: 'Access' },
];

function AuditLogFilters({
  filters,
  onChange,
  actors = [],
  showActorFilter = true,
}: AuditLogFiltersProps) {
  const update = (next: Partial<AuditLogFilterState>) => onChange({ ...filters, ...next });

  return (
    <section
      className="rounded-lg border border-border bg-surface-raised p-4"
      aria-label="Audit log filters"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-overline text-text-subtle">
          <span>Date from</span>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(event) => update({ dateFrom: event.target.value || undefined })}
            className="h-9 w-full rounded-md border border-border bg-surface-base px-3 text-body text-text-normal outline-none focus-visible:border-border-focus"
          />
        </label>
        <label className="space-y-1 text-overline text-text-subtle">
          <span>Date to</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(event) => update({ dateTo: event.target.value || undefined })}
            className="h-9 w-full rounded-md border border-border bg-surface-base px-3 text-body text-text-normal outline-none focus-visible:border-border-focus"
          />
        </label>
        {showActorFilter ? (
          <label className="space-y-1 text-overline text-text-subtle">
            <span>Actor</span>
            <select
              value={filters.actorId ?? ''}
              onChange={(event) => update({ actorId: event.target.value || undefined })}
              className="h-9 w-full rounded-md border border-border bg-surface-base px-3 text-body text-text-normal outline-none focus-visible:border-border-focus"
            >
              <option value="">All actors</option>
              {actors.map((actor) => (
                <option key={actor.memberId} value={actor.memberId}>
                  {actor.globalName ?? actor.username}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="space-y-1 text-overline text-text-subtle">
          <span>Severity</span>
          <select
            value={filters.severity ?? ''}
            onChange={(event) =>
              update({ severity: (event.target.value || undefined) as AuditSeverity | undefined })
            }
            className="h-9 w-full rounded-md border border-border bg-surface-base px-3 text-body text-text-normal outline-none focus-visible:border-border-focus"
          >
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="text-overline text-text-subtle">Action type</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Action type">
          <label
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-body text-text-muted transition-colors',
              !filters.actionType && 'border-brand bg-brand-tint text-text-primary'
            )}
          >
            <input
              type="radio"
              name="actionType"
              checked={!filters.actionType}
              onChange={() => update({ actionType: undefined })}
              className="accent-brand"
            />
            All
          </label>
          {ACTIONS.map((action) => (
            <label
              key={action.value}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-body text-text-muted transition-colors',
                filters.actionType === action.value &&
                  'border-brand bg-brand-tint text-text-primary'
              )}
            >
              <input
                type="radio"
                name="actionType"
                checked={filters.actionType === action.value}
                onChange={() => update({ actionType: action.value })}
                className="accent-brand"
              />
              {action.label}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

export { AuditLogFilters };
