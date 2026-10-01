'use client';

import { useProjectsQuery } from '@/features/projects';
import { useServersQuery } from '@/features/servers';
import { useMemberStatsQuery } from '@/features/stats';
import { summarizeSyncStatus, useSyncStatusAllQuery } from '@/features/sync';
import { StatCard, StatCardError, StatCardSkeleton } from '@/shared/components/ui/stat-card';

function ServersStatCard() {
  const { data, isPending, isError, refetch } = useServersQuery();

  if (isPending) return <StatCardSkeleton label="Servers" />;
  if (isError) return <StatCardError label="Servers" onRetry={() => void refetch()} />;

  return <StatCard label="Servers" value={data.length} accent="brand" />;
}

function ProjectsStatCard() {
  const { data, isPending, isError, refetch } = useProjectsQuery();

  if (isPending) return <StatCardSkeleton label="Projects" />;
  if (isError) return <StatCardError label="Projects" onRetry={() => void refetch()} />;

  return <StatCard label="Projects" value={data.length} accent="brand" />;
}

function MembersStatCard() {
  const { data, isPending, isError, refetch } = useMemberStatsQuery();

  if (isPending) return <StatCardSkeleton label="Members" rows={3} />;
  if (isError) return <StatCardError label="Members" onRetry={() => void refetch()} />;

  return (
    <StatCard
      label="Members"
      value={data.totalMembers.toLocaleString()}
      accent="brand"
      trend={
        data.newMembersThisPeriod > 0
          ? { direction: 'up', label: `+${data.growthRate.toFixed(1)}%` }
          : undefined
      }
    />
  );
}

function SyncStatusStatCard() {
  const { data, isPending, isError, refetch } = useSyncStatusAllQuery();

  if (isPending) return <StatCardSkeleton label="Sync" rows={3} />;
  if (isError) return <StatCardError label="Sync" onRetry={() => void refetch()} />;

  const summary = summarizeSyncStatus(data);

  return (
    <StatCard
      label="Sync"
      value={summary.label}
      accent={summary.tone}
      status={{ tone: summary.tone, label: `${data.length} server${data.length === 1 ? '' : 's'}` }}
    />
  );
}

function QuickStats() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-live="polite"
      aria-atomic="false"
    >
      <ServersStatCard />
      <ProjectsStatCard />
      <MembersStatCard />
      <SyncStatusStatCard />
    </div>
  );
}

export { QuickStats };
