'use client';

import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Shape and animation presets over the shadcn `Skeleton` primitive. `Skeleton`
 * ships `animate-pulse`; `cn()`'s tailwind-merge drops it when a competing
 * `animate-*` class is passed, so `wave` and `none` override cleanly.
 */
export function LoadingSkeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: LoadingSkeletonProps) {
  return (
    <Skeleton
      className={cn(
        animation === 'wave' && 'animate-shimmer',
        animation === 'none' && 'animate-none',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded-sm',
        className
      )}
      style={{
        width: width ?? (variant === 'text' ? '100%' : undefined),
        height: height ?? (variant === 'text' ? '1em' : undefined),
      }}
    />
  );
}

interface SkeletonCardProps {
  showAvatar?: boolean;
  lines?: number;
}

export function SkeletonCard({ showAvatar = true, lines = 3 }: SkeletonCardProps) {
  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      {showAvatar && (
        <div className="flex items-center gap-3">
          <LoadingSkeleton variant="circular" className="h-10 w-10" />
          <div className="space-y-2 flex-1">
            <LoadingSkeleton variant="text" className="h-4 w-1/3" />
            <LoadingSkeleton variant="text" className="h-3 w-1/4" />
          </div>
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <LoadingSkeleton key={i} variant="text" className="h-4" width={`${100 - i * 15}%`} />
        ))}
      </div>
    </div>
  );
}
