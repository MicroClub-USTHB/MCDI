import { useState } from 'react';
import type { FocusEvent, MouseEvent } from 'react';

import { cn } from '@/shared/lib/utils';
import type { ServerStat, ServerStats } from '@/features/stats/types';

interface ServerComparisonChartProps {
  stats: ServerStats;
}

type ServerMetric = 'memberCount' | 'activeMembers' | 'roleCount';

interface MetricDefinition {
  key: ServerMetric;
  label: string;
  color: string;
  className: string;
}

interface ActiveBar {
  serverIndex: number;
  metric: ServerMetric;
}

const metrics: MetricDefinition[] = [
  { key: 'memberCount', label: 'Members', color: 'var(--color-brand)', className: 'bg-brand' },
  {
    key: 'activeMembers',
    label: 'Active members',
    color: 'var(--color-success)',
    className: 'bg-success',
  },
  { key: 'roleCount', label: 'Roles', color: 'var(--color-warning)', className: 'bg-warning' },
];

const CHART_WIDTH = 760;
const CHART_HEIGHT = 286;
const PLOT_LEFT = 42;
const PLOT_RIGHT = 16;
const PLOT_TOP = 24;
const PLOT_BOTTOM = 224;
const LABEL_Y = 258;

function formatServerName(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

function getMetricValue(server: ServerStat, metric: ServerMetric): number {
  return server[metric];
}

function formatMetricValue(value: number): string {
  return value.toLocaleString();
}

function Tooltip({
  server,
  metric,
  x,
}: {
  server: ServerStat;
  metric: MetricDefinition;
  x: number;
}) {
  const left = Math.min(90, Math.max(10, (x / CHART_WIDTH) * 100));
  const value = getMetricValue(server, metric.key);

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-48 -translate-x-1/2 rounded-md border border-border bg-surface-elevated p-3 text-left shadow-dropdown"
      style={{ left: `${left}%` }}
    >
      <p className="truncate text-overline text-text-primary" title={server.serverName}>
        {server.serverName}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3 text-overline text-text-muted">
        <span>{metric.label}</span>
        <span className="font-mono text-text-primary">{formatMetricValue(value)}</span>
      </div>
    </div>
  );
}

function ServerComparisonChart({ stats }: ServerComparisonChartProps) {
  const [activeBar, setActiveBar] = useState<ActiveBar | null>(null);
  const servers = stats.servers;
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const groupWidth = plotWidth / Math.max(servers.length, 1);
  const metricMaxes = metrics.reduce<Record<ServerMetric, number>>(
    (maxes, metric) => {
      maxes[metric.key] = Math.max(
        1,
        ...servers.map((server) => getMetricValue(server, metric.key))
      );
      return maxes;
    },
    { memberCount: 1, activeMembers: 1, roleCount: 1 }
  );
  const activeServer = activeBar ? servers[activeBar.serverIndex] : undefined;
  const activeMetric = activeBar
    ? metrics.find((metric) => metric.key === activeBar.metric)
    : undefined;

  const handleBarLeave = (event: MouseEvent<SVGRectElement>) => {
    if (event.currentTarget !== document.activeElement) setActiveBar(null);
  };
  const handleBarBlur = (event: FocusEvent<SVGRectElement>) => {
    if (!event.currentTarget.matches(':hover')) setActiveBar(null);
  };

  return (
    <div className="min-w-0 space-y-3">
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 text-overline text-text-muted"
        aria-label="Chart legend"
      >
        {metrics.map((metric) => (
          <span key={metric.key} className="inline-flex items-center gap-2">
            <span className={cn('size-2 rounded-sm', metric.className)} aria-hidden="true" />
            {metric.label}
          </span>
        ))}
      </div>
      <p className="text-overline text-text-faint">
        Values are shown exactly on hover; each metric uses its own scale.
      </p>
      <div className="relative min-w-0 overflow-hidden rounded-md border border-border bg-surface-base p-2">
        {activeServer && activeMetric && activeBar ? (
          <Tooltip
            server={activeServer}
            metric={activeMetric}
            x={PLOT_LEFT + activeBar.serverIndex * groupWidth + groupWidth / 2}
          />
        ) : null}
        <svg
          className="h-64 w-full"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label="Server comparison grouped bar chart showing members, active members, and roles by server"
        >
          {[PLOT_TOP, (PLOT_TOP + PLOT_BOTTOM) / 2, PLOT_BOTTOM].map((y) => (
            <line
              key={y}
              x1={PLOT_LEFT}
              x2={CHART_WIDTH - PLOT_RIGHT}
              y1={y}
              y2={y}
              stroke="var(--color-border)"
              strokeDasharray="3 5"
              strokeOpacity="0.75"
            />
          ))}
          {servers.map((server, serverIndex) => {
            const groupLeft = PLOT_LEFT + serverIndex * groupWidth;
            const barGap = 4;
            const barWidth = Math.min(24, Math.max(8, (groupWidth - barGap * 2) / 4));
            const groupBarsWidth = barWidth * metrics.length + barGap * (metrics.length - 1);
            const firstBarX = groupLeft + (groupWidth - groupBarsWidth) / 2;

            return (
              <g
                key={server.serverId}
                role="group"
                aria-label={`${server.serverName} server metrics`}
              >
                {metrics.map((metric, metricIndex) => {
                  const value = getMetricValue(server, metric.key);
                  const height =
                    (Math.max(0, value) / metricMaxes[metric.key]) * (PLOT_BOTTOM - PLOT_TOP);
                  const x = firstBarX + metricIndex * (barWidth + barGap);
                  const y = PLOT_BOTTOM - height;

                  return (
                    <rect
                      key={metric.key}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      rx="2"
                      fill={metric.color}
                      fillOpacity="0.85"
                      tabIndex={0}
                      role="button"
                      aria-label={`${server.serverName}: ${metric.label} ${formatMetricValue(value)}`}
                      onMouseEnter={() => setActiveBar({ serverIndex, metric: metric.key })}
                      onMouseLeave={handleBarLeave}
                      onFocus={() => setActiveBar({ serverIndex, metric: metric.key })}
                      onBlur={handleBarBlur}
                    >
                      <title>{`${server.serverName} ${metric.label}: ${formatMetricValue(value)}`}</title>
                    </rect>
                  );
                })}
                <text
                  x={groupLeft + groupWidth / 2}
                  y={LABEL_Y}
                  fill="var(--color-text-subtle)"
                  fontSize="11"
                  textAnchor="middle"
                >
                  <title>{server.serverName}</title>
                  {formatServerName(server.serverName)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export { ServerComparisonChart };
