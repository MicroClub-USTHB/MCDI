'use client';

import { Eye, RefreshCw } from 'lucide-react';

import { McButton } from '@/shared/components/ui/mc-button';
import { MaskedInput } from '@/shared/components/ui/masked-input';

interface ApiKeyDisplayProps {
  prefix: string | null;
  isActive: boolean;
  /** Render the regenerate action — false hides it entirely. */
  canRegenerate?: boolean;
  onReveal: () => void;
  onRegenerate: () => void;
}

/**
 * Read-only API-key panel. Shows only the prefix (the full key exists nowhere
 * once create/regenerate is done); "Reveal" opens the info modal, "Regenerate"
 * starts the rotation-confirm flow.
 */
function ApiKeyDisplay({
  prefix,
  isActive,
  canRegenerate = true,
  onReveal,
  onRegenerate,
}: ApiKeyDisplayProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-muted-foreground">API key</span>
      <MaskedInput
        value={prefix ?? 'Not generated yet'}
        aria-label="API key prefix"
        showRevealToggle={false}
      />
      <div className="flex flex-wrap items-center gap-2">
        <McButton
          type="button"
          variant="secondary"
          size="sm"
          icon="leading"
          iconDefinition={<Eye aria-hidden="true" />}
          onClick={onReveal}
        >
          Reveal
        </McButton>
        {canRegenerate && (
          <McButton
            type="button"
            variant="secondary"
            size="sm"
            icon="leading"
            iconDefinition={<RefreshCw aria-hidden="true" />}
            onClick={onRegenerate}
            disabled={!isActive}
          >
            Regenerate key
          </McButton>
        )}
        {!isActive && (
          <p className="paragraph-xs font-semibold tracking-wide text-warning">
            Reactivate the project before rotating its key.
          </p>
        )}
      </div>
    </div>
  );
}

export { ApiKeyDisplay, type ApiKeyDisplayProps };
