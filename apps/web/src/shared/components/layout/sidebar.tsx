'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { useAuthStore } from '@/features/auth/stores/auth';
import { SidebarNav } from '@/shared/components/layout/sidebar-nav';
import { McAvatar, McAvatarFallback, McAvatarImage } from '@/shared/components/ui/mc-avatar';
import { McButton } from '@/shared/components/ui/mc-button';
import {
  McDrawer,
  McDrawerContent,
  McDrawerDescription,
  McDrawerTitle,
} from '@/shared/components/ui/mc-drawer';
import {
  McSidebar,
  McSidebarContent,
  McSidebarFade,
  McSidebarFooter,
  McSidebarHeader,
  McSidebarRail,
} from '@/shared/components/ui/mc-sidebar';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
  return initials
    .filter((part): part is string => !!part)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function BrandMark() {
  return (
    <Link
      href="/dashboard"
      className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-heading text-sm font-bold text-sidebar-primary-foreground"
      >
        MC
      </span>
      <McSidebarFade className="flex flex-col leading-tight">
        <span className="font-heading text-sm font-bold text-sidebar-foreground">MCID</span>
        <span className="text-xs text-muted-foreground">Micro Club Identity</span>
      </McSidebarFade>
    </Link>
  );
}

function AccountFooter() {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg p-1">
      <McAvatar size="sm">
        {user.avatar && <McAvatarImage src={user.avatar} alt="" />}
        <McAvatarFallback aria-hidden="true">{getInitials(user.name)}</McAvatarFallback>
      </McAvatar>
      <McSidebarFade className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
        {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
      </McSidebarFade>
      <McSidebarFade>
        <LogoutButton iconOnly />
      </McSidebarFade>
    </div>
  );
}

/** Desktop navigation: a floating mcoli-ui sidebar that collapses to icons (Ctrl/Cmd+B). */
function AppSidebar() {
  return (
    <McSidebar variant="floating" collapsible="icon" aria-label="Primary">
      <McSidebarHeader>
        <BrandMark />
      </McSidebarHeader>
      <McSidebarContent>
        <nav aria-label="Primary">
          <SidebarNav />
        </nav>
      </McSidebarContent>
      <McSidebarFooter className="border-t border-sidebar-border">
        <AccountFooter />
      </McSidebarFooter>
      <McSidebarRail />
    </McSidebar>
  );
}

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

/** Below `md` the sidebar is a drawer from the left, opened from the top bar. */
function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  return (
    <McDrawer direction="left" open={open} onOpenChange={(next) => !next && onClose()}>
      <McDrawerContent
        id="dashboard-sidebar"
        className="bg-sidebar text-sidebar-foreground md:hidden"
      >
        <McDrawerTitle className="sr-only">Navigation</McDrawerTitle>
        <McDrawerDescription className="sr-only">
          Every page of the admin panel you can open.
        </McDrawerDescription>
        <div className="flex items-center justify-between gap-2 p-2">
          <BrandMark />
          <McButton
            variant="tertiary"
            size="sm"
            icon="only"
            iconDefinition={<X aria-hidden="true" />}
            onClick={onClose}
          >
            Close sidebar
          </McButton>
        </div>
        <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          <SidebarNav onNavigate={onClose} />
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <AccountFooter />
        </div>
      </McDrawerContent>
    </McDrawer>
  );
}

export { AppSidebar, MobileSidebar };
