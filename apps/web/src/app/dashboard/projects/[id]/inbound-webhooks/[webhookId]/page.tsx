import { WebhookView } from './webhook-view';

export default async function InboundWebhookPage({
  params,
}: {
  params: Promise<{ id: string; webhookId: string }>;
}) {
  const { webhookId } = await params;
  return <WebhookView webhookId={webhookId} />;
}
