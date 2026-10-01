import { AlertTriangle, CheckCircle2, CircleX, LoaderCircle } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

type HealthState = 'healthy' | 'connected' | 'degraded' | 'disconnected';

interface HealthIndicatorProps {
  service: string;
  status: HealthState;
  details: string;
  isLoading?: boolean;
}

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
  const variant = isHealthy ? 'success' : isDegraded ? 'warning' : 'error';

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{service}</CardTitle>
          <Badge variant={variant}>
            <Icon className={isLoading ? 'animate-spin' : undefined} aria-hidden="true" />
            {isLoading ? 'Checking' : label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 text-body text-text-muted">{details}</CardContent>
    </Card>
  );
}

export { HealthIndicator };
