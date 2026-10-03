import { ServerRedirect } from '@/shared/components/layout/context-redirect';

/** Channels now live under a server: `/dashboard/servers/[id]/channels`. */
export default function ChannelsRedirectPage() {
  return <ServerRedirect path="channels" />;
}
