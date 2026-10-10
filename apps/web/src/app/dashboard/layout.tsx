import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { DashboardShell } from '@/shared/components/layout/dashboard-shell';
import { RequireAccess } from '@/shared/components/layout/require-access';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardShell>
        <RequireAccess>{children}</RequireAccess>
      </DashboardShell>
    </ProtectedRoute>
  );
}
