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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { pickContextId, rememberContextId, useLastContextId } from '@/shared/lib/last-context';
import { cn } from '@/shared/lib/utils';

/** Select value for the switcher's last entry, which opens the list page. */
const LIST_VALUE = '__list__';

interface ContextNavProps {
  context: NavContext;
  pathname: string;
  options: { id: string; name: string }[] | undefined;
}

function ContextNav({ context, pathname, options }: ContextNavProps) {
  const router = useRouter();
  const inUrl = contextFromPath(pathname, context.base);
  const lastId = useLastContextId(context.kind);
  const idInUrl = inUrl?.id ?? null;
  const activeId = idInUrl ?? (options ? pickContextId(options, lastId) : null);

  useEffect(() => {
    if (idInUrl) rememberContextId(context.kind, idInUrl);
  }, [context.kind, idInUrl]);

  if (!options) {
    return <Skeleton className="mx-3 h-9" />;
  }

  if (options.length === 0) {
    return (
      <p className="px-3 text-overline text-text-faint">
        No {context.noun}s yet.{' '}
        <Link href={context.list.route} className="text-brand-light hover:underline">
          Open {context.list.name}
        </Link>
      </p>
    );
  }

  return (
    <>
      <div className="px-1">
        <Select
          value={activeId ?? undefined}
          onValueChange={(value) =>
            router.push(
              value === LIST_VALUE
                ? context.list.route
                : switchTarget(pathname, context.base, value)
            )
          }
        >
          <SelectTrigger aria-label={`Select a ${context.noun}`} className="w-full">
            <SelectValue placeholder={`Select a ${context.noun}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
            <SelectItem value={LIST_VALUE}>All {context.noun}s</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {activeId && (
        <ul className="ml-5 flex flex-col gap-1 border-l border-border pl-2">
          {context.subItems.map((item) => {
            const isActive = idInUrl === activeId && inUrl?.segment === item.segment;
            const Icon = item.icon;
            return (
              <li key={item.segment || 'overview'}>
                <Link
                  href={contextHref(context.base, activeId, item.segment)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-1.5 text-body transition-colors',
                    isActive
                      ? 'bg-surface-active text-text-primary'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text-normal'
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export function ServerContextNav({ context, pathname }: Omit<ContextNavProps, 'options'>) {
  const { data } = useServersQuery();
  return <ContextNav context={context} pathname={pathname} options={data} />;
}

export function ProjectContextNav({ context, pathname }: Omit<ContextNavProps, 'options'>) {
  const { data } = useProjectsQuery();
  return <ContextNav context={context} pathname={pathname} options={data} />;
}
