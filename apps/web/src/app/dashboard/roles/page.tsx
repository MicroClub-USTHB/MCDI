import { ServerRedirect } from '@/shared/components/layout/context-redirect';

/** Roles now live under a server: `/dashboard/servers/[id]/roles`. */
export default function RolesRedirectPage() {
  return <ServerRedirect path="roles" />;
}
