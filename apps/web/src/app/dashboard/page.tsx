import { QuickStats } from '@/app/dashboard/quick-stats';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-hero">Dashboard Overview</h1>
        <p className="mt-1 text-body text-text-muted">Welcome to your dashboard.</p>
      </div>

      <section aria-labelledby="stats-heading" className="flex flex-col gap-3">
        <h2 id="stats-heading" className="text-heading">
          Overview
        </h2>
        <QuickStats />
      </section>
    </div>
  );
}
