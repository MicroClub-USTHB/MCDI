'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { authKeys } from '@/features/auth/api/keys';
import { setForbiddenHandler } from '@/shared/lib/api-client';

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  // A refused call usually means a grant changed: refresh the member's access. One refetch per
  // refusal, and refusals that arrive together share a single request. `/auth/admin/me` itself
  // is never 403 for an admin session, so this cannot loop.
  useEffect(() => {
    setForbiddenHandler(() => {
      void queryClient.invalidateQueries({ queryKey: authKeys.me() }, { cancelRefetch: false });
    });
    return () => setForbiddenHandler(null);
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
