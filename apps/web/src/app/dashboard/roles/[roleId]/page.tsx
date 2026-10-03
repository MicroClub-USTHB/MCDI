import { redirect } from 'next/navigation';

import { ServerRedirect } from '@/shared/components/layout/context-redirect';

/** Old role links carried the server as `?server=`; it is now part of the path. */
export default async function RoleRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ roleId: string }>;
  searchParams: Promise<{ server?: string }>;
}) {
  const { roleId } = await params;
  const { server } = await searchParams;

  if (server) {
    redirect(
      `/dashboard/servers/${encodeURIComponent(server)}/roles/${encodeURIComponent(roleId)}`
    );
  }
  return <ServerRedirect path={`roles/${encodeURIComponent(roleId)}`} />;
}
