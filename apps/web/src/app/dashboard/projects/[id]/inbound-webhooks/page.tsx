import { InboundWebhooksView } from './inbound-webhooks-view';

export default async function ProjectInboundWebhooksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InboundWebhooksView projectId={id} />;
}
