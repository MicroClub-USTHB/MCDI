import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { DashboardShell } from '@/shared/components/layout/dashboard-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardShell>{children}</DashboardShell>
    </ProtectedRoute>
  );
}
