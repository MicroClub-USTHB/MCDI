import { DefaultReadersSettings } from '@/features/inbound-webhooks/components/default-readers-settings';

export default function InboundWebhookSettingsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-hero">Inbound webhook settings</h1>
        <p className="mt-1 text-body text-text-muted">
          The roles that can read the submissions of every new inbound webhook by default. They are
          granted when a webhook is created and can be removed there or later.
        </p>
      </header>
      <DefaultReadersSettings />
    </div>
  );
}
