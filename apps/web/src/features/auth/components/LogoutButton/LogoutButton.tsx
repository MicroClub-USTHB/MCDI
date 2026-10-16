'use client';

import { LogOut } from 'lucide-react';
import { McButton } from '@/shared/components/ui/mc-button';
import { useLogoutMutation } from '@/features/auth/api/mutations';

interface LogoutButtonProps {
  className?: string;
  /** Renders as an icon-only button (e.g. for the sidebar account footer). */
  iconOnly?: boolean;
}

export function LogoutButton({ className, iconOnly = false }: LogoutButtonProps) {
  const { mutate, isPending } = useLogoutMutation();
  const label = isPending ? 'Logging out…' : 'Log out';

  return (
    <McButton
      type="button"
      variant="tertiary"
      size="sm"
      icon={iconOnly ? 'only' : 'leading'}
      iconDefinition={<LogOut aria-hidden="true" />}
      onClick={() => mutate()}
      disabled={isPending}
      aria-busy={isPending}
      className={className}
    >
      {label}
    </McButton>
  );
}
