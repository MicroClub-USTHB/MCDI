import type { Metadata } from 'next';
import { Card } from '@/shared/components/ui/card';
import { DiscordLoginButton } from '@/features/auth/components/DiscordLoginButton';
import { getSafeRedirectPath } from '@/features/auth/lib/safe-redirect';

export const metadata: Metadata = {
  title: 'Login',
};

/**
 * The post-login destination is read from `searchParams` on the server rather
 * than with `useSearchParams` on the client. That keeps this a Server
 * Component — so it can still export `metadata` — and avoids the Suspense
 * boundary a statically-rendered page would otherwise be required to wrap the
 * hook in. Bouncing an already-authenticated admin away from this page is
 * handled in `proxy.ts`, where it happens before any HTML is sent
 * instead of as a post-hydration flash.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { redirect } = await searchParams;
  const redirectPath = getSafeRedirectPath(typeof redirect === 'string' ? redirect : undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base p-4">
      <Card className="w-full max-w-sm gap-0 p-8 py-8">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-on-brand"
          >
            MC
          </span>
          <div>
            <h1 className="text-hero text-text-primary">Welcome to MCDI</h1>
            <p className="mt-1 text-body text-text-muted">
              Sign in with your Discord account to continue
            </p>
          </div>
        </div>
        <DiscordLoginButton size="lg" redirectPath={redirectPath} className="w-full" />
      </Card>
    </div>
  );
}
