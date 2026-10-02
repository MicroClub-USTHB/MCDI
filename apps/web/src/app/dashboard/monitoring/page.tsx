'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { useProjectsQuery } from '@/features/projects';
import { useMembersQuery } from '@/features/members/api/queries';
import type { MemberFilters } from '@/features/members/types';
import {
  AuditLogFilters,
  AuditLogTable,
  AuthFailureTable,
  ErrorRateChart,
  ExportAuditButton,
  HealthIndicator,
  UsageChart,
} from '@/features/monitoring/components';
import {
  useApiUsageQuery,
  useAuditLogsQuery,
  useAuthFailuresQuery,
  useSystemHealthQuery,
} from '@/features/monitoring/api/queries';
import type {
  AuditLogFilters as AuditLogFilterState,
  MonitoringPeriod,
} from '@/features/monitoring/types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { LoadingSkeleton } from '@/shared/components/common';
import { cn } from '@/shared/lib/utils';

const PERIODS: Array<{ value: MonitoringPeriod; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const ACTOR_FILTERS: MemberFilters = {
  filter: 'all',
  serverIds: [],
  roleIds: [],
  page: 1,
  pageSize: 100,
};

// ponytail: naive fixed thresholds, no backend "degraded" signal exists yet.
// Revisit once /admin/monitoring/health reports degraded itself or thresholds need tuning per env.
const DEGRADED_THRESHOLDS = {
  apiResponseMs: 500,
  discordLatencyMs: 200,
  dbQueryMs: 100,
  redisHitRate: 0.5,
};

function MonitoringPage() {
  const [period, setPeriod] = useState<MonitoringPeriod>('30d');
  const [projectId, setProjectId] = useState<string | undefined>();
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilters, setAuditFilters] = useState<AuditLogFilterState>({});

  const projectsQuery = useProjectsQuery();
  const membersQuery = useMembersQuery(ACTOR_FILTERS);
  const usageQuery = useApiUsageQuery(period, projectId);
  const healthQuery = useSystemHealthQuery();
  const failuresQuery = useAuthFailuresQuery();
  const auditQuery = useAuditLogsQuery(auditPage, auditFilters);
  const health = healthQuery.data;
  const serviceDown = health
    ? health.discord.status === 'disconnected' ||
      health.database.status === 'disconnected' ||
      health.redis.status === 'disconnected'
    : false;

  const updateAuditFilters = (filters: AuditLogFilterState) => {
    setAuditPage(1);
    setAuditFilters(filters);
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-overline text-brand-light uppercase">Operations</p>
          <h1 className="mt-1 text-hero text-text-primary">System Monitoring</h1>
          <p className="mt-1 max-w-2xl text-body text-text-muted">
            Track API usage, service health, authentication failures, and audit activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-md border border-border bg-surface-base p-0.5"
            role="group"
            aria-label="Usage period"
          >
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={period === option.value}
                onClick={() => setPeriod(option.value)}
                className={cn(
                  'rounded-sm px-3 py-1.5 text-body text-text-muted transition-colors',
                  period === option.value
                    ? 'bg-surface-active text-text-primary'
                    : 'hover:bg-surface-hover hover:text-text-normal'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {usageQuery.data ? (
            <Badge variant="secondary">
              {usageQuery.data.totalRequests.toLocaleString()} requests
            </Badge>
          ) : null}
        </div>
      </header>

      {serviceDown ? (
        <div
          className="flex items-center gap-3 rounded-lg border border-error bg-error/12 px-4 py-3 text-body text-error"
          role="alert"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          One or more services are unavailable. Review the health indicators below.
        </div>
      ) : null}

      <section aria-labelledby="health-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="health-heading" className="text-heading text-text-primary">
            System health
          </h2>
          {healthQuery.isError ? (
            <Button variant="link" size="sm" onClick={() => void healthQuery.refetch()}>
              <RefreshCw aria-hidden="true" /> Retry
            </Button>
          ) : null}
        </div>
        {healthQuery.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {['API', 'Discord Bot', 'PostgreSQL', 'Redis'].map((service) => (
              <LoadingSkeleton key={service} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : healthQuery.isError ? (
          <Card>
            <CardContent className="py-6 text-body text-error">
              System health could not be loaded.
            </CardContent>
          </Card>
        ) : health ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HealthIndicator
              service="API"
              status={
                health.api.responseTime > DEGRADED_THRESHOLDS.apiResponseMs
                  ? 'degraded'
                  : health.api.status
              }
              details={`${health.api.responseTime} ms response · ${Math.floor(health.api.uptime / 3600)}h uptime`}
            />
            <HealthIndicator
              service="Discord Bot"
              status={
                health.discord.status === 'connected' &&
                health.discord.latency > DEGRADED_THRESHOLDS.discordLatencyMs
                  ? 'degraded'
                  : health.discord.status
              }
              details={`${health.discord.guilds} guilds · ${health.discord.latency >= 0 ? `${health.discord.latency} ms latency` : 'Latency unavailable'}`}
            />
            <HealthIndicator
              service="PostgreSQL"
              status={
                health.database.status === 'connected' &&
                health.database.queryTime > DEGRADED_THRESHOLDS.dbQueryMs
                  ? 'degraded'
                  : health.database.status
              }
              details={`${health.database.queryTime} ms query · ${health.database.connections} connections`}
            />
            <HealthIndicator
              service="Redis"
              status={
                health.redis.status === 'connected' &&
                health.redis.hitRate < DEGRADED_THRESHOLDS.redisHitRate
                  ? 'degraded'
                  : health.redis.status
              }
              details={`${(health.redis.hitRate * 100).toFixed(1)}% hit rate · ${health.redis.memoryUsed}`}
            />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="usage-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="usage-heading" className="text-heading text-text-primary">
            API usage
          </h2>
          {usageQuery.isError ? (
            <Button variant="link" size="sm" onClick={() => void usageQuery.refetch()}>
              <RefreshCw aria-hidden="true" /> Retry
            </Button>
          ) : null}
          <label className="flex items-center gap-2 text-overline text-text-muted">
            Project
            <select
              value={projectId ?? ''}
              onChange={(event) => setProjectId(event.target.value || undefined)}
              className="h-9 rounded-md border border-border bg-surface-base px-3 text-body text-text-normal outline-none focus-visible:border-border-focus"
            >
              <option value="">All projects</option>
              {projectsQuery.data?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {usageQuery.isPending ? <LoadingSkeleton className="h-64 rounded-lg" /> : null}
        {usageQuery.isError ? (
          <Card>
            <CardContent className="py-6 text-body text-error">
              API usage could not be loaded.
            </CardContent>
          </Card>
        ) : null}
        {usageQuery.data ? (
          <div className="grid gap-3 xl:grid-cols-[1.35fr_0.85fr]">
            <UsageChart data={usageQuery.data} />
            <ErrorRateChart data={usageQuery.data} />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="failures-heading" className="space-y-3">
        <h2 id="failures-heading" className="text-heading text-text-primary">
          Recent authentication failures
        </h2>
        {failuresQuery.isError ? (
          <Card>
            <CardContent className="py-6 text-body text-error">
              Authentication failures could not be loaded.
            </CardContent>
          </Card>
        ) : null}
        <AuthFailureTable
          failures={failuresQuery.data?.failures ?? []}
          isLoading={failuresQuery.isPending}
        />
      </section>

      <section aria-labelledby="audit-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="audit-heading" className="text-heading text-text-primary">
            Audit logs
          </h2>
          <div className="flex items-center gap-3">
            {auditQuery.isError ? (
              <Button variant="link" size="sm" onClick={() => void auditQuery.refetch()}>
                <RefreshCw aria-hidden="true" /> Retry
              </Button>
            ) : null}
            <ExportAuditButton filters={auditFilters} />
          </div>
        </div>
        <AuditLogFilters
          filters={auditFilters}
          onChange={updateAuditFilters}
          actors={membersQuery.data?.data ?? []}
        />
        {auditQuery.isError ? (
          <Card>
            <CardContent className="py-6 text-body text-error">
              Audit logs could not be loaded.
            </CardContent>
          </Card>
        ) : (
          <AuditLogTable
            logs={auditQuery.data?.logs ?? []}
            total={auditQuery.data?.total ?? 0}
            page={auditPage}
            pageSize={auditQuery.data?.limit ?? 50}
            isLoading={auditQuery.isPending}
            onPageChange={setAuditPage}
          />
        )}
      </section>
    </div>
  );
}

export default MonitoringPage;
