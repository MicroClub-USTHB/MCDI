import { BarChart3 } from 'lucide-react';

import type { UsageStats } from '@/features/monitoring/types';
import { McCard, McCardContent } from '@/shared/components/ui/mc-card';

interface UsageChartProps {
  data: UsageStats;
}

// TODO(charts): line+area per design once a chart lib lands; blocked on backend
// time-bucketed usage data (`/admin/monitoring/usage` only returns byProject/byEndpoint totals).
function UsageChart({ data }: UsageChartProps) {
  const maxRequests = Math.max(1, ...data.byProject.map((project) => project.requests));

  return (
    <McCard>
      <div className="flex flex-col gap-1">
        <h3 className="paragraph-md font-semibold text-foreground">Requests by project</h3>
        <p className="paragraph-sm text-muted-foreground">API traffic for the selected period.</p>
      </div>
      <McCardContent>
        {data.byProject.length === 0 ? (
          <div className="flex items-center gap-2 py-8 paragraph-sm text-muted-foreground">
            <BarChart3 className="size-4" aria-hidden="true" />
            No project usage recorded for this period.
          </div>
        ) : (
          <div className="space-y-4" role="list" aria-label="Requests by project">
            {data.byProject.map((project) => (
              <div key={project.projectId} role="listitem" className="space-y-1">
                <div className="flex items-center justify-between gap-3 paragraph-sm">
                  <span className="truncate text-foreground">{project.projectName}</span>
                  <span className="shrink-0 font-mono text-foreground">
                    {project.requests.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(project.requests / maxRequests) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
                <p className="paragraph-xs font-semibold tracking-wide text-muted-foreground">
                  {project.errors.toLocaleString()} errors
                </p>
              </div>
            ))}
          </div>
        )}
      </McCardContent>
    </McCard>
  );
}

export { UsageChart };
