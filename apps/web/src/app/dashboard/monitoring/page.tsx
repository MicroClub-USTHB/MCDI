'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { useProjectsQuery } from '@/features/projects';
import { useMembersQuery } from '@/features/members/api/queries';
import { useCan } from '@/shared/lib/use-access';
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
import { McBadge } from '@/shared/components/ui/mc-badge';
import { McButton } from '@/shared/components/ui/mc-button';
import { McCard } from '@/shared/components/ui/mc-card';
import {
  McSelect,
  McSelectContent,
  McSelectItem,
  McSelectTrigger,
  McSelectValue,
} from '@/shared/components/ui/mc-select';
import { LoadingSkeleton } from '@/shared/components/common';

const PERIODS: Array<{ value: MonitoringPeriod; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const ALL_PROJECTS = 'all';

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
  const canMonitoring = useCan('monitoring', 'read');
  const canAudit = useCan('audit', 'read');
  const canProjects = useCan('projects', 'read');
  const canMembers = useCan('members', 'read');
  const health = healthQuery.data;
  const projectItems = [
    { value: ALL_PROJECTS, label: 'All projects' },
    ...(projectsQuery.data ?? []).map((project) => ({ value: project.id, label: project.name })),
  ];
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
          <p className="paragraph-xs font-semibold tracking-wide text-primary uppercase">
            Operations
          </p>
          <h1 className="mt-1 header-xs font-bold text-foreground">System Monitoring</h1>
          <p className="mt-1 max-w-2xl paragraph-sm text-muted-foreground">
            Track API usage, service health, authentication failures, and audit activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex gap-1 rounded-lg border border-border bg-background p-0.5"
            role="group"
            aria-label="Usage period"
          >
            {PERIODS.map((option) => (
              <McButton
                key={option.value}
                type="button"
                size="sm"
                variant={period === option.value ? 'secondary' : 'tertiary'}
                aria-pressed={period === option.value}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </McButton>
            ))}
          </div>
          {usageQuery.data ? (
            <McBadge variant="secondary" size="md">
              {usageQuery.data.totalRequests.toLocaleString()} requests
            </McBadge>
          ) : null}
        </div>
      </header>

      {serviceDown ? (
        <div
          className="flex items-center gap-3 rounded-lg border border-error bg-error/10 px-4 py-3 paragraph-sm text-error"
          role="alert"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          One or more services are unavailable. Review the health indicators below.
        </div>
      ) : null}

      {canMonitoring ? (
        <section aria-labelledby="health-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="health-heading" className="paragraph-md font-semibold text-foreground">
              System health
            </h2>
            {healthQuery.isError ? (
              <McButton
                variant="link"
                size="sm"
                icon="leading"
                iconDefinition={<RefreshCw aria-hidden="true" />}
                onClick={() => void healthQuery.refetch()}
              >
                Retry
              </McButton>
            ) : null}
          </div>
          {healthQuery.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {['API', 'Discord Bot', 'PostgreSQL', 'Redis'].map((service) => (
                <LoadingSkeleton key={service} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : healthQuery.isError ? (
            <McCard>
              <p className="paragraph-sm text-error">System health could not be loaded.</p>
            </McCard>
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
      ) : null}

      {canMonitoring ? (
        <section aria-labelledby="usage-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="usage-heading" className="paragraph-md font-semibold text-foreground">
              API usage
            </h2>
            {usageQuery.isError ? (
              <McButton
                variant="link"
                size="sm"
                icon="leading"
                iconDefinition={<RefreshCw aria-hidden="true" />}
                onClick={() => void usageQuery.refetch()}
              >
                Retry
              </McButton>
            ) : null}
            {canProjects ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Project</span>
                <McSelect
                  items={projectItems}
                  value={projectId ?? ALL_PROJECTS}
                  onValueChange={(value) =>
                    setProjectId(value && value !== ALL_PROJECTS ? String(value) : undefined)
                  }
                >
                  <McSelectTrigger aria-label="Project" size="sm" className="w-56">
                    <McSelectValue />
                  </McSelectTrigger>
                  <McSelectContent className="h-auto max-h-80 w-(--anchor-width)">
                    {projectItems.map((item) => (
                      <McSelectItem key={item.value} value={item.value}>
                        {item.label}
                      </McSelectItem>
                    ))}
                  </McSelectContent>
                </McSelect>
              </div>
            ) : null}
          </div>
          {usageQuery.isPending ? <LoadingSkeleton className="h-64 rounded-lg" /> : null}
          {usageQuery.isError ? (
            <McCard>
              <p className="paragraph-sm text-error">API usage could not be loaded.</p>
            </McCard>
          ) : null}
          {usageQuery.data ? (
            <div className="grid gap-3 xl:grid-cols-[1.35fr_0.85fr]">
              <UsageChart data={usageQuery.data} />
              <ErrorRateChart data={usageQuery.data} />
            </div>
          ) : null}
        </section>
      ) : null}

      {canMonitoring ? (
        <section aria-labelledby="failures-heading" className="space-y-3">
          <h2 id="failures-heading" className="paragraph-md font-semibold text-foreground">
            Recent authentication failures
          </h2>
          {failuresQuery.isError ? (
            <McCard>
              <p className="paragraph-sm text-error">
                Authentication failures could not be loaded.
              </p>
            </McCard>
          ) : null}
          <AuthFailureTable
            failures={failuresQuery.data?.failures ?? []}
            isLoading={failuresQuery.isPending}
          />
        </section>
      ) : null}

      {canAudit ? (
        <section aria-labelledby="audit-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="audit-heading" className="paragraph-md font-semibold text-foreground">
              Audit logs
            </h2>
            <div className="flex items-center gap-3">
              {auditQuery.isError ? (
                <McButton
                  variant="link"
                  size="sm"
                  icon="leading"
                  iconDefinition={<RefreshCw aria-hidden="true" />}
                  onClick={() => void auditQuery.refetch()}
                >
                  Retry
                </McButton>
              ) : null}
              <ExportAuditButton filters={auditFilters} />
            </div>
          </div>
          <AuditLogFilters
            filters={auditFilters}
            onChange={updateAuditFilters}
            actors={membersQuery.data?.data ?? []}
            showActorFilter={canMembers}
          />
          {auditQuery.isError ? (
            <McCard>
              <p className="paragraph-sm text-error">Audit logs could not be loaded.</p>
            </McCard>
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
      ) : null}
    </div>
  );
}

export default MonitoringPage;
