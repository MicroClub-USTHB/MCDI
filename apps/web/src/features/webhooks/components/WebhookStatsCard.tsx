import { StatCard } from '@/shared/components/ui/stat-card';

interface WebhookStatsCardProps {
  usageCount: number;
  lastUsed: string;
}

export function WebhookStatsCard({ usageCount, lastUsed }: WebhookStatsCardProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <StatCard size="compact" label="Messages sent" value={usageCount.toLocaleString()} />
      <StatCard size="compact" label="Last used" value={lastUsed} />
    </div>
  );
}
