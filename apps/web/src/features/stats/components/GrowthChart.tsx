import { useId, useState } from 'react';
import type { FocusEvent, MouseEvent } from 'react';

import { cn } from '@/shared/lib/utils';
import type { GrowthPoint, GrowthStats } from '@/features/stats/types';

interface GrowthChartProps {
  stats: GrowthStats;
}

interface ChartPoint {
  point: GrowthPoint;
  x: number;
  y: number;
}

const CHART_WIDTH = 760;
const CHART_HEIGHT = 236;
const PLOT_LEFT = 16;
const PLOT_RIGHT = 16;
const PLOT_TOP = 18;
/** Shared baseline: the cumulative area, the line's zero, and the flow bars all sit on this. */
const PLOT_BOTTOM = 190;
const BAR_MAX_HEIGHT = 44;
const LABEL_Y = 214;

function formatDate(date: string): string {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: parsedDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(parsedDate);
}

function formatAxisDate(date: string): string {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parsedDate);
}

function getLabelIndexes(length: number): Set<number> {
  if (length <= 6) return new Set(Array.from({ length }, (_, index) => index));

  const step = Math.ceil((length - 1) / 5);
  const indexes = new Set<number>();
  for (let index = 0; index < length; index += step) indexes.add(index);
  indexes.add(length - 1);
  return indexes;
}

function Tooltip({ point, x }: { point: GrowthPoint; x: number }) {
  const left = Math.min(91, Math.max(9, (x / CHART_WIDTH) * 100));

  return (
    <div
      className="pointer-events-none absolute top-1 z-10 w-44 -translate-x-1/2 rounded-md border border-border bg-surface-elevated p-3 text-left shadow-dropdown"
      style={{ left: `${left}%` }}
    >
      <p className="text-overline text-text-primary">{formatDate(point.date)}</p>
      <dl className="mt-2 space-y-1 text-overline text-text-muted">
        <div className="flex items-center justify-between gap-3">
          <dt>Cumulative</dt>
          <dd className="font-mono text-text-primary">{point.count.toLocaleString()}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>New members</dt>
          <dd className="font-mono text-success">+{point.newMembers.toLocaleString()}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>Members left</dt>
          <dd className="font-mono text-error">
            {point.leftMembers > 0 ? '-' : ''}
            {point.leftMembers.toLocaleString()}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-1 text-text-normal">
          <dt>Net</dt>
          <dd className={cn('font-mono', point.netMembers >= 0 ? 'text-success' : 'text-error')}>
            {point.netMembers > 0 ? '+' : ''}
            {point.netMembers.toLocaleString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function GrowthChart({ stats }: GrowthChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, '');
  const points = stats.data;
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const maxFlow = Math.max(1, ...points.flatMap((point) => [point.newMembers, point.leftMembers]));
  const labelIndexes = getLabelIndexes(points.length);

  const chartPoints: ChartPoint[] = points.map((point, index) => {
    const x =
      PLOT_LEFT + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    // 0-based scale — a near-flat cumulative line then reads as a filled area,
    // not a thin line glued to the top of an empty plot.
    const y = PLOT_BOTTOM - (point.count / maxCount) * (PLOT_BOTTOM - PLOT_TOP);
    return { point, x, y };
  });

  const linePath = chartPoints
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');
  const activePoint = activeIndex === null ? null : chartPoints[activeIndex];

  const handlePointEnter = (index: number) => setActiveIndex(index);
  const handlePointLeave = (event: MouseEvent<SVGCircleElement>) => {
    if (event.currentTarget !== document.activeElement) setActiveIndex(null);
  };
  const handlePointFocus = (index: number) => setActiveIndex(index);
  const handlePointBlur = (event: FocusEvent<SVGCircleElement>) => {
    if (!event.currentTarget.matches(':hover')) setActiveIndex(null);
  };

  return (
    <div className="min-w-0 space-y-3">
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 text-overline text-text-muted"
        aria-label="Chart legend"
      >
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
          Cumulative members
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-sm bg-success" aria-hidden="true" />
          New members
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-sm bg-error" aria-hidden="true" />
          Members left
        </span>
      </div>

      <div className="relative min-w-0 overflow-hidden rounded-md border border-border bg-surface-base p-2">
        {activePoint ? <Tooltip point={activePoint.point} x={activePoint.x} /> : null}
        <svg
          className="h-56 w-full"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label="Member growth showing cumulative members, new members, and members who left"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.24" />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* gridlines — the bottom one is the shared solid baseline */}
          {[PLOT_TOP, (PLOT_TOP + PLOT_BOTTOM) / 2].map((y) => (
            <line
              key={y}
              x1={PLOT_LEFT}
              x2={CHART_WIDTH - PLOT_RIGHT}
              y1={y}
              y2={y}
              stroke="var(--color-border)"
              strokeDasharray="3 5"
              strokeOpacity="0.6"
            />
          ))}
          <line
            x1={PLOT_LEFT}
            x2={CHART_WIDTH - PLOT_RIGHT}
            y1={PLOT_BOTTOM}
            y2={PLOT_BOTTOM}
            stroke="var(--color-border)"
          />

          {chartPoints.length > 1 ? (
            <path
              d={`${linePath} L ${chartPoints[chartPoints.length - 1]?.x ?? PLOT_LEFT} ${PLOT_BOTTOM} L ${chartPoints[0]?.x ?? PLOT_LEFT} ${PLOT_BOTTOM} Z`}
              fill={`url(#${gradientId})`}
            />
          ) : null}

          {/* per-bucket flow: green new / red departed, rising from the same baseline */}
          {chartPoints.map(({ point, x }, index) => {
            const newHeight = (point.newMembers / maxFlow) * BAR_MAX_HEIGHT;
            const leftHeight = (point.leftMembers / maxFlow) * BAR_MAX_HEIGHT;
            const barWidth = Math.min(12, Math.max(3, plotWidth / Math.max(points.length, 1) / 4));

            return (
              <g key={`${point.date}-${index}-flow`}>
                {point.newMembers > 0 ? (
                  <rect
                    x={x - barWidth - 1}
                    y={PLOT_BOTTOM - newHeight}
                    width={barWidth}
                    height={newHeight}
                    rx="1.5"
                    fill="var(--color-success)"
                    fillOpacity="0.9"
                  >
                    <title>{`New members: ${point.newMembers}`}</title>
                  </rect>
                ) : null}
                {point.leftMembers > 0 ? (
                  <rect
                    x={x + 1}
                    y={PLOT_BOTTOM - leftHeight}
                    width={barWidth}
                    height={leftHeight}
                    rx="1.5"
                    fill="var(--color-error)"
                    fillOpacity="0.9"
                  >
                    <title>{`Members left: ${point.leftMembers}`}</title>
                  </rect>
                ) : null}
                {labelIndexes.has(index) ? (
                  <text
                    x={x}
                    y={LABEL_Y}
                    fill="var(--color-text-subtle)"
                    fontSize="11"
                    textAnchor="middle"
                  >
                    {formatAxisDate(point.date)}
                  </text>
                ) : null}
              </g>
            );
          })}

          <path
            d={linePath}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {chartPoints.map(({ point, x, y }, index) => (
            <circle
              key={`${point.date}-point`}
              cx={x}
              cy={y}
              r={activeIndex === index ? 5 : 3.5}
              fill="var(--color-surface-raised)"
              stroke="var(--color-brand)"
              strokeWidth="2.5"
              tabIndex={0}
              role="button"
              aria-label={`${formatDate(point.date)}: ${point.count} cumulative members, ${point.newMembers} new, ${point.leftMembers} left, ${point.netMembers} net`}
              onMouseEnter={() => handlePointEnter(index)}
              onMouseLeave={handlePointLeave}
              onFocus={() => handlePointFocus(index)}
              onBlur={handlePointBlur}
            >
              <title>{`${formatDate(point.date)}: ${point.count} cumulative, ${point.newMembers} new, ${point.leftMembers} left`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}

export { GrowthChart };
