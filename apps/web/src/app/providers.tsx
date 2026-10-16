'use client';

import { QueryProvider } from '@/providers';
import { SessionProvider } from '@/features/auth/components/SessionProvider';
import { McSonner } from '@/shared/components/ui/mc-sonner';
import { McTooltipProvider } from '@/shared/components/ui/mc-tooltip';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <McTooltipProvider>
        <SessionProvider>{children}</SessionProvider>
      </McTooltipProvider>
      <McSonner />
    </QueryProvider>
  );
}
