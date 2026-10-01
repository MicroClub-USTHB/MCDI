'use client';

import { QueryProvider } from '@/providers';
import { SessionProvider } from '@/features/auth/components/SessionProvider';
import { ToastContainer } from '@/shared/components/common';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <SessionProvider>{children}</SessionProvider>
      <ToastContainer />
    </QueryProvider>
  );
}
