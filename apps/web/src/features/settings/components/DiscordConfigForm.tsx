import { useId } from 'react';
import { Bot } from 'lucide-react';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { MaskedInput } from '@/shared/components/ui/masked-input';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import type { DiscordSettings } from '@/features/settings/types';

interface DiscordConfigFormProps {
  config: DiscordSettings;
}

/** Not a secret, just a copyable read-only value (guild/client id, callback URL). */
const labelClass = 'text-sm font-medium text-muted-foreground';

function CopyableValue({ label, value }: { label: string; value: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <MaskedInput id={id} value={value} />
    </div>
  );
}

function SecretStatus({ label, isSet }: { label: string; isSet: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={labelClass}>{label}</span>
      <McBadge
        variant="outline"
        className={isSet ? 'border-success/30 bg-success/10 text-success' : undefined}
      >
        {isSet ? 'Configured' : 'Not configured'}
      </McBadge>
    </div>
  );
}

/**
 * Boot-time Discord config, surfaced read-only: these come from environment
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
