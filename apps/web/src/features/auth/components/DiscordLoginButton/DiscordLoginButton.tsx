'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { getDiscordOAuthUrl, rememberPostLoginRedirect } from '@/features/auth/api/service';

type DiscordLoginButtonSize = 'sm' | 'md' | 'lg';
type DiscordLoginButtonVariant = 'solid' | 'outline';

interface DiscordLoginButtonProps {
  size?: DiscordLoginButtonSize;
  variant?: DiscordLoginButtonVariant;
  redirectPath?: string;
  isLoading?: boolean;
  className?: string;
}

const VARIANT_MAP = {
  solid: 'primary',
  outline: 'secondary',
} as const;

function DiscordMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036 19.736 19.736 0 0 0-4.885 1.49.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.175 13.175 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.246.195.373.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028ZM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.311-.956 2.38-2.157 2.38Zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.311-.947 2.38-2.157 2.38Z" />
    </svg>
  );
}

export function DiscordLoginButton({
  size = 'md',
  variant = 'solid',
  redirectPath,
  isLoading = false,
  className,
}: DiscordLoginButtonProps) {
  return (
    <Button
      asChild
      variant={VARIANT_MAP[variant]}
      size={size}
      className={cn(isLoading && 'pointer-events-none opacity-70', className)}
    >
      <a
        href={getDiscordOAuthUrl()}
        aria-disabled={isLoading}
        aria-busy={isLoading}
        // `aria-disabled` on an <a> only advertises the state to assistive
        // tech and `pointer-events-none` only blocks the mouse — neither
        // stops a keyboard Enter/Space activation, so guard the navigation
        // itself while loading.
        //
        // The destination is stashed here rather than put on the href: the
        // backend accepts no `redirect` parameter, so it has to survive the
        // OAuth round trip client-side.
        onClick={(event) => {
          if (isLoading) {
            event.preventDefault();
            return;
          }
          rememberPostLoginRedirect(redirectPath);
        }}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <DiscordMark className="h-4 w-4" />
        )}
        <span>{isLoading ? 'Connecting to Discord…' : 'Login with Discord'}</span>
      </a>
    </Button>
  );
}
