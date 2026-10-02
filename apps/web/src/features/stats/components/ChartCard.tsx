import type { ReactNode } from 'react';

import { BarChart3, RotateCw } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { LoadingSkeleton } from '@/shared/components/common';
import { cn } from '@/shared/lib/utils';

interface ChartCardProps {
  title: string;
  description: string;
  action?: ReactNode;
  /** Optional caveat shown under the description (e.g. "Limited data — 11 members"). */
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  description,
  action,
  hint,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={cn('min-w-0 gap-0 py-0', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-subhead text-text-primary">{title}</h3>
          <p className="mt-1 text-overline text-text-muted">{description}</p>
          {hint ? <p className="mt-1 text-overline text-warning">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      {/* min-h matches ChartLoading's h-56 skeleton exactly, so the swap never shifts the page (CLS). */}
      <CardContent className="@container flex min-h-56 min-w-0 flex-col justify-center px-4 py-4">
        {children}
      </CardContent>
    </Card>
  );
}

export function ChartLoading({ label }: { label: string }) {
  return (
    <div className="w-full space-y-3" role="status" aria-label={`Loading ${label}`}>
      <span className="sr-only">Loading {label}</span>
      <LoadingSkeleton className="h-56 w-full" />
      <div className="flex justify-between gap-3" aria-hidden="true">
        <LoadingSkeleton className="h-3 w-16" />
        <LoadingSkeleton className="h-3 w-16" />
        <LoadingSkeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function ChartEmpty({ description }: { description: string }) {
  return (
    <div className="flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-surface-base px-4 text-center">
      <BarChart3 className="size-7 text-text-faint" aria-hidden="true" />
      <p className="max-w-sm text-body text-text-muted">{description}</p>
    </div>
  );
}

export function ChartError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-md border border-error/40 bg-error/10 px-4 text-center">
      <p className="text-body text-error">This statistic could not be loaded.</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RotateCw aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
