'use client';

import { Eye, RefreshCw } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
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
      <Label>API key</Label>
      <MaskedInput
        value={prefix ?? 'Not generated yet'}
        aria-label="API key prefix"
        showRevealToggle={false}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onReveal}>
          <Eye aria-hidden="true" />
          Reveal
        </Button>
        {canRegenerate && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRegenerate}
            disabled={!isActive}
          >
            <RefreshCw aria-hidden="true" />
            Regenerate key
          </Button>
        )}
        {!isActive && (
          <p className="text-overline text-warning">
            Reactivate the project before rotating its key.
          </p>
        )}
      </div>
    </div>
  );
}

export { ApiKeyDisplay, type ApiKeyDisplayProps };
