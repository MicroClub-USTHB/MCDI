import { WebhooksView } from './webhooks-view';

export default async function ProjectWebhooksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WebhooksView projectId={id} />;
}
