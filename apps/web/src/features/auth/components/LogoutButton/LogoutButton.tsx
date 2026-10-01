'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useLogoutMutation } from '@/features/auth/api/mutations';

interface LogoutButtonProps {
  className?: string;
  /** Renders as an icon-only ghost button (e.g. for the sidebar account footer). */
  iconOnly?: boolean;
}

export function LogoutButton({ className, iconOnly = false }: LogoutButtonProps) {
  const { mutate, isPending } = useLogoutMutation();
  const label = isPending ? 'Logging out…' : 'Log out';

  return (
    <Button
      type="button"
      variant="ghost"
      size={iconOnly ? 'icon-sm' : 'sm'}
      onClick={() => mutate()}
      disabled={isPending}
      aria-busy={isPending}
      aria-label={iconOnly ? label : undefined}
      className={className}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {!iconOnly && label}
    </Button>
  );
}
