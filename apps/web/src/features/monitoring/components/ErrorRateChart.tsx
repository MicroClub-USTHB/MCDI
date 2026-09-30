import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { UsageStats } from '@/features/monitoring/types';

interface ErrorRateChartProps {
  data: UsageStats;
}

// TODO(charts): line+area per design once a chart lib lands; see UsageChart.
function ErrorRateChart({ data }: ErrorRateChartProps) {
  const errorTypes = [
    { label: '4xx client errors', value: data.errors.byType['4xx'], color: 'bg-warning' },
    { label: '5xx server errors', value: data.errors.byType['5xx'], color: 'bg-error' },
  ];
  const maxValue = Math.max(1, ...errorTypes.map((item) => item.value));
  const errorRate = data.totalRequests === 0 ? 0 : (data.errors.total / data.totalRequests) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Error rate</CardTitle>
        <p className="text-body text-text-muted">
          {errorRate.toFixed(2)}% ({data.errors.total.toLocaleString()} errors) in the selected
          period.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorTypes.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-body">
              <span className="text-text-muted">{item.label}</span>
              <span className="font-mono text-text-primary">{item.value.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-hover">
              <div
                className={`h-2 rounded-full ${item.color}`}
                style={{ width: `${(item.value / maxValue) * 100}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export { ErrorRateChart };
