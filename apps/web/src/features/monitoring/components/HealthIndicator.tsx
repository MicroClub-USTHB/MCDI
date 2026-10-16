import { AlertTriangle, CheckCircle2, CircleX, LoaderCircle } from 'lucide-react';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { McCard } from '@/shared/components/ui/mc-card';

type HealthState = 'healthy' | 'connected' | 'degraded' | 'disconnected';

interface HealthIndicatorProps {
  service: string;
  status: HealthState;
  details: string;
  isLoading?: boolean;
}

const TONE_CLASSES = {
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  error: '',
} as const;

function HealthIndicator({ service, status, details, isLoading = false }: HealthIndicatorProps) {
  const isHealthy = status === 'healthy' || status === 'connected';
  const isDegraded = status === 'degraded';
  const label = isHealthy ? 'Online' : isDegraded ? 'Degraded' : 'Down';
  const Icon = isLoading
    ? LoaderCircle
    : isHealthy
      ? CheckCircle2
      : isDegraded
        ? AlertTriangle
        : CircleX;
  const tone = isHealthy ? 'success' : isDegraded ? 'warning' : 'error';

  return (
    <McCard className="gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="paragraph-md font-semibold text-foreground">{service}</h3>
        <McBadge
          data-tone={tone}
          variant={tone === 'error' ? 'destructive' : 'outline'}
          className={TONE_CLASSES[tone]}
          icon={<Icon className={isLoading ? 'animate-spin' : undefined} aria-hidden="true" />}
        >
          {isLoading ? 'Checking' : label}
        </McBadge>
      </div>
      <p className="paragraph-sm text-muted-foreground">{details}</p>
    </McCard>
  );
}

export { HealthIndicator };
