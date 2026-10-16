'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useProjectsQuery } from '@/features/projects/api/queries';
import { useServersQuery } from '@/features/servers/api/queries';
import {
  contextFromPath,
  contextHref,
  switchTarget,
  type NavContext,
} from '@/shared/components/layout/nav-items';
import {
  McSelect,
  McSelectContent,
  McSelectItem,
  McSelectTrigger,
  McSelectValue,
} from '@/shared/components/ui/mc-select';
import {
  McSidebarMenuSub,
  McSidebarMenuSubButton,
  McSidebarMenuSubItem,
} from '@/shared/components/ui/mc-sidebar';
import { McSkeleton } from '@/shared/components/ui/mc-skeleton';
import { pickContextId, rememberContextId, useLastContextId } from '@/shared/lib/last-context';

/** Select value for the switcher's last entry, which opens the list page. */
const LIST_VALUE = '__list__';

interface ContextNavProps {
  context: NavContext;
  pathname: string;
  options: { id: string; name: string }[] | undefined;
  onNavigate?: () => void;
}

function ContextNav({ context, pathname, options, onNavigate }: ContextNavProps) {
  const router = useRouter();
  const inUrl = contextFromPath(pathname, context.base);
  const lastId = useLastContextId(context.kind);
  const idInUrl = inUrl?.id ?? null;
  const activeId = idInUrl ?? (options ? pickContextId(options, lastId) : null);

  useEffect(() => {
    if (idInUrl) rememberContextId(context.kind, idInUrl);
  }, [context.kind, idInUrl]);

  if (!options) {
    return <McSkeleton rectangle className="mx-2 mt-2 h-9 group-data-[collapsible=icon]:hidden" />;
  }

  if (options.length === 0) {
    return (
      <p className="px-2 pt-2 paragraph-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        No {context.noun}s yet.{' '}
        <Link href={context.list.route} className="font-medium text-primary hover:underline">
          Open {context.list.name}
        </Link>
      </p>
    );
  }

  const items = [
    ...options.map((option) => ({ value: option.id, label: option.name })),
    { value: LIST_VALUE, label: `All ${context.noun}s` },
  ];

  return (
    <div className="mt-2 flex flex-col gap-2 group-data-[collapsible=icon]:hidden">
      <McSelect
        items={items}
        value={activeId}
        onValueChange={(value) => {
          if (typeof value !== 'string') return;
          onNavigate?.();
          router.push(
            value === LIST_VALUE ? context.list.route : switchTarget(pathname, context.base, value)
          );
        }}
      >
        <McSelectTrigger size="sm" aria-label={`Select a ${context.noun}`} className="w-full">
          <McSelectValue placeholder={`Select a ${context.noun}`} className="truncate" />
        </McSelectTrigger>
        <McSelectContent className="h-auto max-h-80 w-(--anchor-width)">
          {items.map((item) => (
            <McSelectItem key={item.value} value={item.value}>
              {item.label}
            </McSelectItem>
          ))}
        </McSelectContent>
      </McSelect>

      {activeId && (
        <McSidebarMenuSub>
          {context.subItems.map((item) => {
            const isActive = idInUrl === activeId && inUrl?.segment === item.segment;
            const Icon = item.icon;
            return (
              <McSidebarMenuSubItem key={item.segment || 'overview'}>
                <McSidebarMenuSubButton
                  isActive={isActive}
                  render={
                    <Link
                      href={contextHref(context.base, activeId, item.segment)}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={onNavigate}
                    />
                  }
                >
                  <Icon aria-hidden="true" />
                  <span>{item.name}</span>
                </McSidebarMenuSubButton>
              </McSidebarMenuSubItem>
            );
          })}
        </McSidebarMenuSub>
      )}
    </div>
  );
}

export function ServerContextNav(props: Omit<ContextNavProps, 'options'>) {
  const { data } = useServersQuery();
  return <ContextNav {...props} options={data} />;
}

export function ProjectContextNav(props: Omit<ContextNavProps, 'options'>) {
  const { data } = useProjectsQuery();
  return <ContextNav {...props} options={data} />;
}
