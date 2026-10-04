import { CreateWebhookForm } from '@/features/inbound-webhooks/components/create-webhook-form';

export default async function NewInboundWebhookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-hero">New inbound webhook</h1>
        <p className="mt-1 max-w-2xl text-body text-text-muted">
          Describe the form, choose who reads the submissions, and you get a signing secret to give
          to the caller.
        </p>
      </header>
      <CreateWebhookForm projectId={id} />
    </div>
  );
}
