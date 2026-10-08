'use client';

import { useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { useAuthStore } from '@/features/auth/stores/auth';
import { ProjectContextNav, ServerContextNav } from '@/shared/components/layout/context-nav';
import { isLinkActive } from '@/shared/components/layout/nav-items';
import { visibleNavGroups } from '@/shared/components/layout/visible-nav';
import { useAccessSubject } from '@/shared/lib/use-access';
import { cn } from '@/shared/lib/utils';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
  return initials
    .filter((part): part is string => !!part)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const subject = useAccessSubject();
  const groups = useMemo(() => visibleNavGroups(subject), [subject]);
  const asideRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Mobile-only modal behavior: on desktop `open` stays false (the trigger
  // that flips it is `md:hidden`) and the sidebar is shown persistently via
  // CSS, not this state, so this trap never engages there.
  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !asideRef.current) return;

      const focusable = asideRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-overlay md:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <aside
        ref={asideRef}
        id="dashboard-sidebar"
        aria-label="Primary"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen w-sidebar shrink-0 flex-col transition-transform',
          // No border/background: the sidebar blends into the shell's own
          // surface-base rather than reading as a separate boxed panel.
          'md:static md:inset-auto md:z-auto md:h-auto md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-topbar items-center justify-between border-b border-border px-4">
          <span className="text-heading text-text-primary">MCDI</span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-normal md:hidden"
            aria-label="Close sidebar"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {groups.map(({ group, items, context }) => {
            const headingId = `nav-group-${group.label.toLowerCase()}`;
            return (
              <div
                key={group.label}
                role="group"
                aria-labelledby={headingId}
                className="flex flex-col gap-1"
              >
                <p id={headingId} className="px-3 text-overline text-text-faint uppercase">
                  {group.label}
                </p>
                {items.map((item) => {
                  const isActive = isLinkActive(pathname, item);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.route}
                      href={item.route}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-body transition-colors',
                        isActive
                          ? 'bg-surface-active text-text-primary'
                          : 'text-text-muted hover:bg-surface-hover hover:text-text-normal'
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
                {context?.kind === 'server' && (
                  <ServerContextNav context={context} pathname={pathname} />
                )}
                {context?.kind === 'project' && (
                  <ProjectContextNav context={context} pathname={pathname} />
                )}
              </div>
            );
          })}
        </nav>
        {user && (
          <div className="flex items-center gap-3 border-t border-border p-3">
            {user.avatar ? (
              <Image
                src={user.avatar}
                alt=""
                width={32}
                height={32}
                unoptimized
                className="size-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-overline text-text-primary"
                aria-hidden="true"
              >
                {getInitials(user.name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-body text-text-normal">{user.name}</p>
              {user.email && (
                <p className="truncate text-overline text-text-subtle">{user.email}</p>
              )}
            </div>
            <LogoutButton iconOnly />
          </div>
        )}
      </aside>
    </>
  );
}

export { Sidebar };
