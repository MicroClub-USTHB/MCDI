import { McInput } from '@/shared/components/ui/mc-input';
import { McRadioGroup, McRadioGroupItem } from '@/shared/components/ui/mc-radio-group';
import {
  McSelect,
  McSelectContent,
  McSelectItem,
  McSelectTrigger,
  McSelectValue,
} from '@/shared/components/ui/mc-select';
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

/** Sentinel for the "no filter" option, since a select value cannot be empty. */
const ALL = 'all';

const SEVERITIES = [
  { value: ALL, label: 'All severities' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

const fieldLabelClass = 'text-sm font-medium text-muted-foreground';

function AuditLogFilters({
  filters,
  onChange,
  actors = [],
  showActorFilter = true,
}: AuditLogFiltersProps) {
  const update = (next: Partial<AuditLogFilterState>) => onChange({ ...filters, ...next });
  const actorItems = [
    { value: ALL, label: 'All actors' },
    ...actors.map((actor) => ({
      value: actor.memberId,
      label: actor.globalName ?? actor.username,
    })),
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-label="Audit log filters">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <McInput
          type="date"
          label="Date from"
          value={filters.dateFrom ?? ''}
          onChange={(event) => update({ dateFrom: event.target.value || undefined })}
        />
        <McInput
          type="date"
          label="Date to"
          value={filters.dateTo ?? ''}
          onChange={(event) => update({ dateTo: event.target.value || undefined })}
        />
        {showActorFilter ? (
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabelClass}>Actor</span>
            <McSelect
              items={actorItems}
              value={filters.actorId ?? ALL}
              onValueChange={(value) =>
                update({ actorId: value && value !== ALL ? String(value) : undefined })
              }
            >
              <McSelectTrigger aria-label="Actor" className="w-full">
                <McSelectValue />
              </McSelectTrigger>
              <McSelectContent className="h-auto max-h-80 w-(--anchor-width)">
                {actorItems.map((item) => (
                  <McSelectItem key={item.value} value={item.value}>
                    {item.label}
                  </McSelectItem>
                ))}
              </McSelectContent>
            </McSelect>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <span className={fieldLabelClass}>Severity</span>
          <McSelect
            items={SEVERITIES}
            value={filters.severity ?? ALL}
            onValueChange={(value) =>
              update({
                severity: value && value !== ALL ? (value as AuditSeverity) : undefined,
              })
            }
          >
            <McSelectTrigger aria-label="Severity" className="w-full">
              <McSelectValue />
            </McSelectTrigger>
            <McSelectContent className="h-auto max-h-80 w-(--anchor-width)">
              {SEVERITIES.map((item) => (
                <McSelectItem key={item.value} value={item.value}>
                  {item.label}
                </McSelectItem>
              ))}
            </McSelectContent>
          </McSelect>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <span id="audit-action-type-label" className={fieldLabelClass}>
          Action type
        </span>
        <McRadioGroup
          aria-labelledby="audit-action-type-label"
          value={filters.actionType ?? ALL}
          onValueChange={(value) =>
            update({
              actionType: value && value !== ALL ? (value as AuditActionType) : undefined,
            })
          }
          className="flex flex-wrap gap-2"
        >
          {[{ value: ALL, label: 'All' }, ...ACTIONS].map((action) => (
            <McRadioGroupItem
              key={action.value}
              value={action.value}
              text={action.label}
              className={cn(
                'rounded-lg border border-border px-3 py-2 transition-colors',
                (filters.actionType ?? ALL) === action.value && 'border-primary bg-secondary'
              )}
            />
          ))}
        </McRadioGroup>
      </div>
    </section>
  );
}

export { AuditLogFilters };
