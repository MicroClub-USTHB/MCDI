'use client';

import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/providers';
import { SessionProvider } from '@/features/auth/components/SessionProvider';
import { McSonner } from '@/shared/components/ui/mc-sonner';
import { McTooltipProvider } from '@/shared/components/ui/mc-tooltip';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <McTooltipProvider>
          <SessionProvider>{children}</SessionProvider>
        </McTooltipProvider>
        <McSonner />
      </QueryProvider>
    </ThemeProvider>
  );
}
