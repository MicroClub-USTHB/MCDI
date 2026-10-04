'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, FolderKanban, Server } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useProjectsQuery } from '@/features/projects/api/queries';
import { useServersQuery } from '@/features/servers/api/queries';
import { LoadingSkeleton } from '@/shared/components/common';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { pickContextId, useLastContextId, type ContextKind } from '@/shared/lib/last-context';

interface RedirectorProps {
  kind: ContextKind;
  base: string;
  path: string;
  options: { id: string }[] | undefined;
  isError: boolean;
  onRetry: () => void;
  empty: { icon: LucideIcon; title: string; description: string };
}

/**
 * Pages that used to stand alone now live under a server or a project. An old
 * link lands here and is sent to the same page of the last-used (or first)
 * server or project, so bookmarks keep working.
 */
function Redirector({ kind, base, path, options, isError, onRetry, empty }: RedirectorProps) {
  const router = useRouter();
  const lastId = useLastContextId(kind);
  const targetId = options ? pickContextId(options, lastId) : null;

  useEffect(() => {
    if (targetId) router.replace(`${base}/${targetId}${path ? `/${path}` : ''}`);
  }, [targetId, base, path, router]);

  if (isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t open this page"
        description="The list it depends on could not be loaded. Try again in a moment."
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  if (options && options.length === 0) {
    return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />;
  }
  return <LoadingSkeleton className="h-64 rounded-lg" />;
}

export function ServerRedirect({ path }: { path: string }) {
  const query = useServersQuery();
  return (
    <Redirector
      kind="server"
      base="/dashboard/servers"
      path={path}
      options={query.data}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      empty={{
        icon: Server,
        title: 'No servers yet',
        description: 'Add a Discord server from the Servers page to manage it here.',
      }}
    />
  );
}

export function ProjectRedirect({ path }: { path: string }) {
  const query = useProjectsQuery();
  return (
    <Redirector
      kind="project"
      base="/dashboard/projects"
      path={path}
      options={query.data}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      empty={{
        icon: FolderKanban,
        title: 'No projects yet',
        description: 'Create a project from the Projects page to manage it here.',
      }}
    />
  );
}
