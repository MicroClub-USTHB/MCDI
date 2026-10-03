import { ServerRedirect } from '@/shared/components/layout/context-redirect';

/** Sync now lives under a server: `/dashboard/servers/[id]/sync`. "Sync all" is on the Servers page. */
export default function SyncRedirectPage() {
  return <ServerRedirect path="sync" />;
}
