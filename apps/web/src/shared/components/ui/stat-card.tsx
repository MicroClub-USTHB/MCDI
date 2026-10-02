import * as React from 'react';
import { RotateCw, TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * MCDI V2 stat tile — overline label, value, and a trend/status line under a
 * colored top accent bar. Not a shadcn primitive; composed directly from
 * tokens rather than `Card` since the accent bar needs to sit flush against
 * the card's top edge, outside `Card`'s padded layout.
 *
 * `size="compact"` drops the value to `text-heading` and puts trend + status
 * on one wrapping row, so a 4-up KPI grid stays dense instead of leaving each
 * tile mostly whitespace.
 */
type StatCardAccent = 'brand' | 'success' | 'error' | 'warning';
type StatCardSize = 'default' | 'compact';

const accentBarClass: Record<StatCardAccent, string> = {
  brand: 'bg-brand',
  success: 'bg-success',
  error: 'bg-error',
  warning: 'bg-warning',
};

const trendClass: Record<'up' | 'down', string> = {
  up: 'text-success',
  down: 'text-error',
};

interface StatCardProps extends React.ComponentProps<'div'> {
  label: string;
  value: React.ReactNode;
  accent?: StatCardAccent;
  size?: StatCardSize;
  trend?: {
    direction: 'up' | 'down';
    label: string;
    /** Native tooltip — used to explain a substituted value (e.g. small-base growth). */
    title?: string;
  };
  status?: {
    tone: StatCardAccent;
    label: string;
  };
  /**
   * Series for a mini trend line under the value. Passing the prop at all
   * (even `[]`) reserves the row so late-arriving data doesn't shift layout;
   * the line draws once there are 2+ points.
   */
  sparkline?: number[];
}

function Sparkline({ points }: { points: number[] }) {
  const width = 100;
  const height = 20;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      className="h-full w-full text-brand"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  accent = 'brand',
  size = 'default',
  trend,
  status,
  sparkline,
  className,
  ...props
}: StatCardProps) {
  const TrendIcon = trend?.direction === 'down' ? TrendingDown : TrendingUp;
  const compact = size === 'compact';

  return (
    <div
      data-slot="stat-card"
      className={cn('overflow-hidden rounded-lg border border-border bg-surface-raised', className)}
      {...props}
    >
      <div className={cn('h-1', accentBarClass[accent])} aria-hidden="true" />
      <div className={cn('flex flex-col p-4', compact ? 'gap-0.5' : 'gap-1')}>
        <span className="text-overline text-text-subtle uppercase">{label}</span>
        <span className={cn('text-text-primary', compact ? 'text-heading' : 'text-hero')}>
          {value}
        </span>
        {sparkline !== undefined ? (
          <div className="mt-1 h-5">
            {sparkline.length > 1 ? <Sparkline points={sparkline} /> : null}
          </div>
        ) : null}
        {(trend || status) && (
          <div
            className={cn(
              'text-body',
              compact
                ? 'mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5'
                : 'flex flex-col gap-1'
            )}
          >
            {trend && (
              <span
                title={trend.title}
                className={cn('inline-flex items-center gap-1', trendClass[trend.direction])}
              >
                <TrendIcon className="size-4" aria-hidden="true" />
                {trend.label}
              </span>
            )}
            {status && (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <span
                  className={cn('size-2 rounded-full', accentBarClass[status.tone])}
                  aria-hidden="true"
                />
                {status.label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardSkeletonProps extends React.ComponentProps<'div'> {
  label: string;
  /** Pass 3 when the resolved card will render a trend/status line, so the skeleton reserves that row and doesn't shift the layout on load. */
  rows?: 2 | 3;
  /** Reserve space for a mini sparkline so the resolved card doesn't shift the layout. */
  sparkline?: boolean;
}

/** Matches `StatCard`'s real footprint (accent bar + label + value [+ sparkline] [+ trend/status]) to avoid layout shift when the real card mounts. */
function StatCardSkeleton({
  label,
  rows = 2,
  sparkline = false,
  className,
  ...props
}: StatCardSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('overflow-hidden rounded-lg border border-border bg-surface-raised', className)}
      {...props}
    >
      <span className="sr-only">Loading {label}…</span>
      <Skeleton className="h-1 rounded-none" />
      <div className="flex flex-col gap-1 p-4" aria-hidden="true">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-20" />
        {sparkline && <Skeleton className="h-5 w-full" />}
        {rows === 3 && <Skeleton className="h-4 w-24" />}
      </div>
    </div>
  );
}

interface StatCardErrorProps extends React.ComponentProps<'div'> {
  label: string;
  onRetry: () => void;
}

function StatCardError({ label, onRetry, className, ...props }: StatCardErrorProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-lg border border-border bg-surface-raised', className)}
      {...props}
    >
      <div className="h-1 bg-error" aria-hidden="true" />
      <div className="flex flex-col gap-1 p-4">
        <span className="text-overline text-text-subtle uppercase">{label}</span>
        <span className="text-body text-error">Failed to load</span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex w-fit items-center gap-1 text-body text-error hover:underline focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised focus-visible:outline-none"
        >
          <RotateCw className="size-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    </div>
  );
}

export { StatCard, StatCardSkeleton, StatCardError, type StatCardProps };
