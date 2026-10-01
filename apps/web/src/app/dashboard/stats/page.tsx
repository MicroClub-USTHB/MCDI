'use client';

import { useState } from 'react';

import { RotateCw } from 'lucide-react';

import { useServersQuery } from '@/features/servers';
import {
  ChartCard,
  ChartEmpty,
  ChartError,
  ChartLoading,
  GrowthChart,
  MemberActivityChart,
  RoleDistributionChart,
  ServerComparisonChart,
  StatsExportButtons,
} from '@/features/stats/components';
import {
  useMemberGrowthQuery,
  useMemberStatsQuery,
  useRoleStatsQuery,
  useServerStatsQuery,
} from '@/features/stats/api/queries';
import type { GrowthGranularity, StatsDateRange } from '@/features/stats/types';
import { Badge } from '@/shared/components/ui/badge';
import { StatCard, StatCardError, StatCardSkeleton } from '@/shared/components/ui/stat-card';
import { cn } from '@/shared/lib/utils';

const DATE_RANGE_OPTIONS: Array<{ value: StatsDateRange; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
];

function getGrowthGranularity(dateRange: StatsDateRange) {
  if (dateRange === '90d') return 'weekly' as const;
  if (dateRange === '1y') return 'monthly' as const;
  return 'daily' as const;
}

function formatGrowthRate(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function dateRangeLabel(dateRange: StatsDateRange): string {
  if (dateRange === '7d') return 'the last 7 days';
  if (dateRange === '90d') return 'the last 90 days';
  if (dateRange === '1y') return 'the last year';
  return 'the last 30 days';
}

const GRANULARITY_LABEL: Record<GrowthGranularity, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function growthDescription(dateRange: StatsDateRange, granularity: GrowthGranularity): string {
  return `${GRANULARITY_LABEL[granularity]} buckets · ${dateRangeLabel(dateRange).replace('the ', '')}`;
}

/**
 * A raw newMembers/priorBase percentage is nonsense at low counts (11 members
 * off a base of 1 reads "+1000%"). Below a base of 10 we show the absolute
 * change instead and explain why in the tooltip.
 */
function growthIndicator(
  total: number,
  newMembers: number,
  growthRate: number
): { direction: 'up' | 'down'; label: string; title?: string } {
  const priorBase = total - newMembers;
  if (priorBase <= 0) {
    return {
      direction: 'up',
      label: `+${newMembers.toLocaleString()} new`,
      title: 'No members before this period — a percentage change is not meaningful.',
    };
  }
  if (priorBase < 10) {
    return {
      direction: newMembers >= 0 ? 'up' : 'down',
      label: `${newMembers >= 0 ? '+' : ''}${newMembers.toLocaleString()}`,
      title: `Only ${priorBase.toLocaleString()} members before this period — showing the absolute change instead of a percentage.`,
    };
  }
  return {
    direction: growthRate >= 0 ? 'up' : 'down',
    label: formatGrowthRate(growthRate),
  };
}

/** Below this, charts are shaped by a handful of rows and read as noise. */
const LOW_DATA_THRESHOLD = 10;

const KPI_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4';

function MemberSummary({
  isPending,
  isError,
  onRetry,
  dateRange,
  totalMembers,
  clubMembers,
  activeMembers,
  inactiveMembers,
  newMembersThisPeriod,
  growthRate,
  totalSeries,
}: {
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  dateRange: StatsDateRange;
  totalMembers?: number;
  clubMembers?: number;
  activeMembers?: number;
  inactiveMembers?: number;
  newMembersThisPeriod?: number;
  growthRate?: number;
  /** Cumulative-member series for the Total members sparkline. */
  totalSeries?: number[];
}) {
  if (isPending) {
    return (
      <div className={KPI_GRID} aria-label="Loading member summary">
        <StatCardSkeleton label="Total members" rows={3} sparkline />
        <StatCardSkeleton label="Club members" rows={3} />
        <StatCardSkeleton label="Active members" rows={3} />
        <StatCardSkeleton label="New members" rows={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={KPI_GRID}>
        <StatCardError
          label="Member statistics"
          onRetry={onRetry}
          className="sm:col-span-2 lg:col-span-4"
        />
      </div>
    );
  }

  const safeTotalMembers = totalMembers ?? 0;
  const safeClubMembers = clubMembers ?? 0;
  const safeActiveMembers = activeMembers ?? 0;
  const safeInactiveMembers = inactiveMembers ?? 0;
  const safeNewMembers = newMembersThisPeriod ?? 0;
  const safeGrowthRate = growthRate ?? 0;
  const growth = growthIndicator(safeTotalMembers, safeNewMembers, safeGrowthRate);

  return (
    <div className={KPI_GRID} aria-live="polite">
      <StatCard
        label="Total members"
        value={safeTotalMembers.toLocaleString()}
        accent="brand"
        size="compact"
        sparkline={totalSeries ?? []}
        trend={growth}
        status={{ tone: 'brand', label: `${safeClubMembers.toLocaleString()} club members` }}
      />
      <StatCard
        label="Club members"
        value={safeClubMembers.toLocaleString()}
        accent="brand"
        size="compact"
        status={{
          tone: 'brand',
          label: `${(safeTotalMembers - safeClubMembers).toLocaleString()} other members`,
        }}
      />
      <StatCard
        label="Active members"
        value={safeActiveMembers.toLocaleString()}
        accent="success"
        size="compact"
        status={{
          tone: safeInactiveMembers === 0 ? 'success' : 'warning',
          label: `${safeInactiveMembers.toLocaleString()} inactive`,
        }}
      />
      <StatCard
        label="New members"
        value={safeNewMembers.toLocaleString()}
        accent="success"
        size="compact"
        status={{ tone: 'success', label: `Within ${dateRangeLabel(dateRange)}` }}
      />
    </div>
  );
}

function MemberStatisticsPage() {
  const [dateRange, setDateRange] = useState<StatsDateRange>('30d');
  const [selectedServerId, setSelectedServerId] = useState('');
  const serverId = selectedServerId || undefined;
  const growthGranularity = getGrowthGranularity(dateRange);

  const serversQuery = useServersQuery();
  const memberStatsQuery = useMemberStatsQuery({ serverId, dateRange });
  const growthQuery = useMemberGrowthQuery(dateRange, growthGranularity);
  const roleQuery = useRoleStatsQuery(serverId);
  const serverStatsQuery = useServerStatsQuery();

  const selectedServer = serversQuery.data?.find((server) => server.id === selectedServerId);
  const scopeLabel = selectedServer?.name ?? 'All servers';

  const totalSeries = growthQuery.data?.data.map((point) => point.count);
  const totalMembers = memberStatsQuery.data?.totalMembers;
  const lowData =
    totalMembers !== undefined && totalMembers < LOW_DATA_THRESHOLD
      ? `Limited data — ${totalMembers.toLocaleString()} member${totalMembers === 1 ? '' : 's'} in scope`
      : undefined;

  const exportData =
    memberStatsQuery.data || growthQuery.data || roleQuery.data || serverStatsQuery.data
      ? {
          memberStats: memberStatsQuery.data,
          growthStats: growthQuery.data,
          roleStats: roleQuery.data,
          serverStats: serverStatsQuery.data,
        }
      : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="min-w-0">
        <h1 className="text-hero text-text-primary">Member Statistics</h1>
        <p className="mt-1 max-w-xl text-body text-text-muted">
          Membership, growth, roles, and activity across managed servers.
        </p>
      </header>

      {/* One filter bar: every control the same 36px height and surface, export pushed right. */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-raised p-2"
        role="group"
        aria-label="Statistics filters"
      >
        <div
          className="flex h-9 items-center rounded-md border border-border bg-surface-base p-0.5"
          role="group"
          aria-label="Date range"
        >
          {DATE_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'h-full rounded px-3 text-overline whitespace-nowrap text-text-muted transition-colors outline-none hover:text-text-normal focus-visible:ring-2 focus-visible:ring-border-focus',
                dateRange === option.value && 'bg-surface-elevated text-text-primary'
              )}
              aria-pressed={dateRange === option.value}
              onClick={() => setDateRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Server"
          className="h-9 w-48 rounded-md border border-border bg-surface-base px-3 text-body text-text-normal outline-none transition-colors focus:border-border-focus disabled:cursor-not-allowed disabled:opacity-60"
          value={selectedServerId}
          onChange={(event) => setSelectedServerId(event.target.value)}
          disabled={serversQuery.isPending}
        >
          <option value="">All servers</option>
          {serversQuery.data?.map((server) => (
            <option key={server.id} value={server.id}>
              {server.name}
            </option>
          ))}
        </select>

        {serversQuery.isError ? (
          <button
            type="button"
            onClick={() => void serversQuery.refetch()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-overline text-error transition-colors hover:bg-error/10 focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
          >
            <RotateCw className="size-3.5" aria-hidden="true" />
            Servers failed — retry
          </button>
        ) : null}

        <div className="ml-auto">
          <StatsExportButtons data={exportData} />
        </div>
      </div>

      <section aria-labelledby="summary-heading" className="flex flex-col gap-3">
        <h2 id="summary-heading" className="text-subhead text-text-primary">
          Overview
        </h2>
        <MemberSummary
          isPending={memberStatsQuery.isPending}
          isError={memberStatsQuery.isError}
          onRetry={() => void memberStatsQuery.refetch()}
          dateRange={dateRange}
          totalMembers={memberStatsQuery.data?.totalMembers}
          clubMembers={memberStatsQuery.data?.clubMembers}
          activeMembers={memberStatsQuery.data?.activeMembers}
          inactiveMembers={memberStatsQuery.data?.inactiveMembers}
          newMembersThisPeriod={memberStatsQuery.data?.newMembersThisPeriod}
          growthRate={memberStatsQuery.data?.growthRate}
          totalSeries={totalSeries}
        />
      </section>

      <section aria-labelledby="trend-heading" className="grid min-w-0 gap-4 xl:grid-cols-12">
        <h2 id="trend-heading" className="sr-only">
          Membership trends and roles
        </h2>
        <ChartCard
          className="xl:col-span-8"
          title="Member growth"
          description={growthDescription(dateRange, growthGranularity)}
          hint={lowData}
          action={
            growthQuery.data ? (
              <Badge variant={growthQuery.data.totalGrowth >= 0 ? 'success' : 'error'}>
                Net {growthQuery.data.totalGrowth > 0 ? '+' : ''}
                {growthQuery.data.totalGrowth.toLocaleString()}
              </Badge>
            ) : null
          }
        >
          {growthQuery.isPending ? <ChartLoading label="member growth" /> : null}
          {growthQuery.isError ? <ChartError onRetry={() => void growthQuery.refetch()} /> : null}
          {growthQuery.data && growthQuery.data.data.length === 0 ? (
            <ChartEmpty description="Not enough data yet for this period." />
          ) : null}
          {growthQuery.data && growthQuery.data.data.length > 0 ? (
            <GrowthChart stats={growthQuery.data} />
          ) : null}
        </ChartCard>

        <ChartCard
          className="xl:col-span-4"
          title="Roles"
          description={
            roleQuery.data?.scope === 'server'
              ? `Roles in ${roleQuery.data.serverName ?? 'selected server'}`
              : 'Global role distribution'
          }
          hint={lowData}
          action={roleQuery.data ? <Badge variant="secondary">{roleQuery.data.scope}</Badge> : null}
        >
          {roleQuery.isPending ? <ChartLoading label="role distribution" /> : null}
          {roleQuery.isError ? <ChartError onRetry={() => void roleQuery.refetch()} /> : null}
          {roleQuery.data && roleQuery.data.roles.length === 0 ? (
            <ChartEmpty description="Not enough data yet for this scope." />
          ) : null}
          {roleQuery.data && roleQuery.data.roles.length > 0 ? (
            <RoleDistributionChart stats={roleQuery.data} />
          ) : null}
        </ChartCard>
      </section>

      <section aria-labelledby="activity-heading" className="grid min-w-0 gap-4 xl:grid-cols-12">
        <h2 id="activity-heading" className="sr-only">
          Member activity and server comparison
        </h2>
        <ChartCard
          className="xl:col-span-4"
          title="Member activity"
          description={`Active vs inactive members in ${scopeLabel}`}
          hint={lowData}
        >
          {memberStatsQuery.isPending ? <ChartLoading label="member activity" /> : null}
          {memberStatsQuery.isError ? (
            <ChartError onRetry={() => void memberStatsQuery.refetch()} />
          ) : null}
          {memberStatsQuery.data &&
          memberStatsQuery.data.activeMembers + memberStatsQuery.data.inactiveMembers === 0 ? (
            <ChartEmpty description="Not enough data yet for this scope." />
          ) : null}
          {memberStatsQuery.data &&
          memberStatsQuery.data.activeMembers + memberStatsQuery.data.inactiveMembers > 0 ? (
            <MemberActivityChart stats={memberStatsQuery.data} />
          ) : null}
        </ChartCard>

        <ChartCard
          className="xl:col-span-8"
          title="Members by Server"
          description="Cross-server comparison across managed servers"
        >
          {serverStatsQuery.isPending ? <ChartLoading label="server comparison" /> : null}
          {serverStatsQuery.isError ? (
            <ChartError onRetry={() => void serverStatsQuery.refetch()} />
          ) : null}
          {serverStatsQuery.data && serverStatsQuery.data.servers.length === 0 ? (
            <ChartEmpty description="Not enough data yet to compare servers." />
          ) : null}
          {serverStatsQuery.data && serverStatsQuery.data.servers.length > 0 ? (
            <ServerComparisonChart stats={serverStatsQuery.data} />
          ) : null}
        </ChartCard>
      </section>
    </div>
  );
}

export default MemberStatisticsPage;
