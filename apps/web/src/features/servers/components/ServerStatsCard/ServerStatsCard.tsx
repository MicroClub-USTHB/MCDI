import type { StatCardProps } from '@/shared/components/ui/stat-card';
import { StatCard, StatCardSkeleton } from '@/shared/components/ui/stat-card';
import type { ServerStat } from '@/features/stats/types';

interface ServerStatsCardProps {
  stats: ServerStat | undefined;
  isLoading: boolean;
}

type StatCardAccent = NonNullable<StatCardProps['accent']>;

/** `/admin/stats/servers` types `syncStatus` as a free string — fall back rather than trust the enum. */
const SYNC_STATUS_TONE: Record<string, StatCardAccent> = {
  success: 'success',
  failure: 'error',
  never: 'warning',
};

const SYNC_STATUS_LABEL: Record<string, string> = {
  success: 'Succeeded',
  failure: 'Failed',
  never: 'Never synced',
};

function syncTone(status: string): StatCardAccent {
  return SYNC_STATUS_TONE[status] ?? 'warning';
}

function syncLabel(status: string): string {
  return SYNC_STATUS_LABEL[status] ?? status;
}

function formatLastSync(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ServerStatsCard({ stats, isLoading }: ServerStatsCardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton label="Members" />
        <StatCardSkeleton label="Active Members" />
        <StatCardSkeleton label="Roles" />
        <StatCardSkeleton label="Sync Status" rows={3} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-body text-text-muted">
        No stats available for this server yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Members" value={stats.memberCount.toLocaleString()} accent="brand" />
      <StatCard
        label="Active Members"
        value={stats.activeMembers.toLocaleString()}
        accent="brand"
      />
      <StatCard label="Roles" value={stats.roleCount.toLocaleString()} accent="brand" />
      <StatCard
        label="Sync Status"
        value={syncLabel(stats.syncStatus)}
        accent={syncTone(stats.syncStatus)}
        status={{
          tone: syncTone(stats.syncStatus),
          label: `Last sync: ${formatLastSync(stats.lastSync)}`,
        }}
      />
    </div>
  );
}

export { ServerStatsCard, type ServerStatsCardProps };
