'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, RefreshCcw } from 'lucide-react';

import {
  CrossServerView,
  MemberPermissionsPanel,
  MemberProfileCard,
  RoleList,
} from '@/features/members/components';
import { useMemberPermissionsQueries, useMemberQuery } from '@/features/members/api/queries';
import { McButton, buttonVariants } from '@/shared/components/ui/mc-button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { LoadingSkeleton } from '@/shared/components/common';
import { ROOT_ONLY } from '@/shared/lib/access';
import { useCanAccess } from '@/shared/lib/use-access';

function MemberDetailSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingSkeleton className="h-32 rounded-lg" />
      <LoadingSkeleton className="h-48 rounded-lg" />
      <LoadingSkeleton className="h-40 rounded-lg" />
    </div>
  );
}

export default function MemberDetailPage() {
  const params = useParams<{ discordId: string }>();
  const router = useRouter();
  const isRoot = useCanAccess(ROOT_ONLY);
  const value = params.discordId;
  const discordId =
    typeof value === 'string' ? value : Array.isArray(value) ? (value[0] ?? '') : '';

  const memberQuery = useMemberQuery(discordId);

  const serverIds = useMemo(
    () => memberQuery.data?.servers.map((server) => server.serverId) ?? [],
    [memberQuery.data?.servers]
  );
  const permissionsQuery = useMemberPermissionsQueries(discordId, serverIds);

  const primaryServer =
    memberQuery.data?.servers.find((server) => server.isMainServer) ?? memberQuery.data?.servers[0];

  if (memberQuery.isPending) {
    return <MemberDetailSkeleton />;
  }

  if (memberQuery.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load member"
        description="The member detail view is unavailable right now."
        actionLabel="Retry"
        onAction={() => {
          void memberQuery.refetch();
          void permissionsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <McButton
          variant="secondary"
          icon="leading"
          iconDefinition={<ArrowLeft aria-hidden="true" />}
          onClick={() => router.push('/dashboard/members')}
        >
          Back to members
        </McButton>
        <div className="flex items-center gap-2">
          {isRoot ? (
            <Link
              href={`/dashboard/members/${encodeURIComponent(discordId)}/access`}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Access
            </Link>
          ) : null}
          <McButton
            variant="secondary"
            icon="leading"
            iconDefinition={<RefreshCcw aria-hidden="true" />}
            onClick={() => {
              void memberQuery.refetch();
              void permissionsQuery.refetch();
            }}
          >
            Refresh
          </McButton>
        </div>
      </div>

      <MemberProfileCard member={memberQuery.data} />

      {primaryServer ? (
        <RoleList roles={primaryServer.roles} serverName={primaryServer.serverName} />
      ) : null}

      <CrossServerView memberId={memberQuery.data.memberId} servers={memberQuery.data.servers} />

      {permissionsQuery.isPending ? (
        <LoadingSkeleton className="h-48 rounded-lg" />
      ) : (
        <MemberPermissionsPanel
          permissionsByServer={
            memberQuery.data?.servers.map((server, index) => ({
              serverId: server.serverId,
              serverName: server.serverName,
              permissions: permissionsQuery.data[index] ?? null,
            })) ?? []
          }
        />
      )}
    </div>
  );
}
