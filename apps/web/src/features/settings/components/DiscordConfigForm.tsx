import { Bot } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Label } from '@/shared/components/ui/label';
import { MaskedInput } from '@/shared/components/ui/masked-input';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import type { DiscordSettings } from '@/features/settings/types';

interface DiscordConfigFormProps {
  config: DiscordSettings;
}

/** Not a secret — just a copyable read-only value (guild/client id, callback URL). */
function CopyableValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <MaskedInput value={value} />
    </div>
  );
}

function SecretStatus({ label, isSet }: { label: string; isSet: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Badge variant={isSet ? 'success' : 'outline'}>
        {isSet ? 'Configured' : 'Not configured'}
      </Badge>
    </div>
  );
}

/**
 * Boot-time Discord config, surfaced read-only — these come from environment
 * variables and are only ever writable by editing the backend's `.env`.
 * Secrets never carry a value over the wire, only `isSet`, so there is
 * nothing to reveal or edit here.
 */
function DiscordConfigForm({ config }: DiscordConfigFormProps) {
  return (
    <SettingsSection
      title="Discord configuration"
      icon={Bot}
      description="Set via environment variables on the backend. Read-only here."
    >
      <CopyableValue label="Client ID" value={config.clientId.value} />
      <CopyableValue label="Main guild ID" value={config.guildId.value} />
      <CopyableValue label="OAuth callback URL" value={config.callbackUrl.value} />
      <SecretStatus label="Bot token" isSet={config.token.isSet} />
      <SecretStatus label="Client secret" isSet={config.clientSecret.isSet} />
    </SettingsSection>
  );
}

export { DiscordConfigForm, type DiscordConfigFormProps };
