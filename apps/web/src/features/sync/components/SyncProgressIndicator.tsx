interface SyncProgressIndicatorProps {
  inProgress: boolean;
  label?: string;
}

/**
 * Indeterminate bar — the backend only reports a binary in-progress state, so
 * there's no percentage or stage breakdown to show. Renders nothing when idle.
 */
export function SyncProgressIndicator({
  inProgress,
  label = 'Sync in progress',
}: SyncProgressIndicatorProps) {
  if (!inProgress) return null;

  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <span className="paragraph-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
        <div className="h-full w-1/4 rounded-full bg-primary animate-sync-indeterminate" />
      </div>
    </div>
  );
}
