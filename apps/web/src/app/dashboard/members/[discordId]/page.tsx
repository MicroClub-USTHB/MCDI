'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, RefreshCcw } from 'lucide-react';

import {
  CrossServerView,
  MemberPermissionsPanel,
  MemberProfileCard,
  RoleList,
} from '@/features/members/components';
import { useMemberPermissionsQueries, useMemberQuery } from '@/features/members/api/queries';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { LoadingSkeleton } from '@/shared/components/common';

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
        <Button variant="secondary" onClick={() => router.push('/dashboard/members')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to members
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            void memberQuery.refetch();
            void permissionsQuery.refetch();
          }}
        >
          <RefreshCcw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
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
