'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ProjectContextNav, ServerContextNav } from '@/shared/components/layout/context-nav';
import { isLinkActive } from '@/shared/components/layout/nav-items';
import { visibleNavGroups } from '@/shared/components/layout/visible-nav';
import {
  McSidebarGroup,
  McSidebarGroupContent,
  McSidebarGroupLabel,
  McSidebarMenu,
  McSidebarMenuButton,
  McSidebarMenuItem,
} from '@/shared/components/ui/mc-sidebar';
import { useAccessSubject } from '@/shared/lib/use-access';

interface SidebarNavProps {
  /** Called after a link is followed, so the mobile drawer can close. */
  onNavigate?: () => void;
}

/** The navigation groups the member can see, shared by the desktop sidebar and the mobile drawer. */
function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const subject = useAccessSubject();
  const groups = useMemo(() => visibleNavGroups(subject), [subject]);

  return (
    <>
      {groups.map(({ group, items, context }) => {
        const headingId = `nav-group-${group.label.toLowerCase()}`;
        return (
          <McSidebarGroup key={group.label} role="group" aria-labelledby={headingId}>
            <McSidebarGroupLabel id={headingId}>{group.label}</McSidebarGroupLabel>
            <McSidebarGroupContent>
              <McSidebarMenu>
                {items.map((item) => {
                  const isActive = isLinkActive(pathname, item);
                  const Icon = item.icon;
                  return (
                    <McSidebarMenuItem key={item.route}>
                      <McSidebarMenuButton
                        isActive={isActive}
                        tooltip={item.name}
                        render={
                          <Link
                            href={item.route}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={onNavigate}
                          />
                        }
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.name}</span>
                      </McSidebarMenuButton>
                    </McSidebarMenuItem>
                  );
                })}
              </McSidebarMenu>
              {context?.kind === 'server' && (
                <ServerContextNav context={context} pathname={pathname} onNavigate={onNavigate} />
              )}
              {context?.kind === 'project' && (
                <ProjectContextNav context={context} pathname={pathname} onNavigate={onNavigate} />
              )}
            </McSidebarGroupContent>
          </McSidebarGroup>
        );
      })}
    </>
  );
}

export { SidebarNav };
