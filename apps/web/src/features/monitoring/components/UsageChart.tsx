import { BarChart3 } from 'lucide-react';

import type { UsageStats } from '@/features/monitoring/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

interface UsageChartProps {
  data: UsageStats;
}

// TODO(charts): line+area per design once a chart lib lands; blocked on backend
// time-bucketed usage data (`/admin/monitoring/usage` only returns byProject/byEndpoint totals).
function UsageChart({ data }: UsageChartProps) {
  const maxRequests = Math.max(1, ...data.byProject.map((project) => project.requests));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requests by project</CardTitle>
        <p className="text-body text-text-muted">API traffic for the selected period.</p>
      </CardHeader>
      <CardContent>
        {data.byProject.length === 0 ? (
          <div className="flex items-center gap-2 py-8 text-body text-text-muted">
            <BarChart3 className="size-4" aria-hidden="true" />
            No project usage recorded for this period.
          </div>
        ) : (
          <div className="space-y-4" role="list" aria-label="Requests by project">
            {data.byProject.map((project) => (
              <div key={project.projectId} role="listitem" className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-body">
                  <span className="truncate text-text-normal">{project.projectName}</span>
                  <span className="shrink-0 font-mono text-text-primary">
                    {project.requests.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-hover">
                  <div
                    className="h-2 rounded-full bg-brand"
                    style={{ width: `${(project.requests / maxRequests) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
                <p className="text-overline text-text-muted">
                  {project.errors.toLocaleString()} errors
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { UsageChart };
