import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthCallbackHandler } from '@/features/auth/components/AuthCallbackHandler';

export const metadata: Metadata = {
  title: 'Signing in',
};

export default function CallbackPage() {
  return (
    <Suspense
      fallback={<div role="status" aria-label="Loading" className="min-h-screen bg-surface-base" />}
    >
      <AuthCallbackHandler />
    </Suspense>
  );
}
