'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

import {
  useAccessCatalogQuery,
  useAccessRolesQuery,
  useOverridesListQuery,
} from '@/features/access';
import { OverridesList } from '@/features/access/components/OverridesList';
import { RoleEditor } from '@/features/access/components/RoleEditor';
import { RoleList } from '@/features/access/components/RoleList';
import { LoadingSkeleton } from '@/shared/components/common';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

function RolesTab() {
  const roles = useAccessRolesQuery();
  const catalog = useAccessCatalogQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (roles.isError || catalog.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load the roles"
        actionLabel="Retry"
        onAction={() => {
          void roles.refetch();
          void catalog.refetch();
        }}
      />
    );
  }
  if (!roles.data || !catalog.data) return <LoadingSkeleton className="h-96 rounded-lg" />;

  const selected =
    roles.data.find((role) => role.id === selectedId) ??
    [...roles.data].sort((a, b) => (b.position ?? 0) - (a.position ?? 0))[0] ??
    null;

  if (!selected) {
    return <EmptyState title="No roles" description="The main server has no roles yet." />;
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <RoleList roles={roles.data} selectedId={selected.id} onSelect={setSelectedId} />
      <RoleEditor key={selected.id} role={selected} catalog={catalog.data} />
    </div>
  );
}

function OverridesTab() {
  const overrides = useOverridesListQuery();

  if (overrides.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load the overrides"
        actionLabel="Retry"
        onAction={() => void overrides.refetch()}
      />
    );
  }
  if (!overrides.data) return <LoadingSkeleton className="h-48 rounded-lg" />;
  return <OverridesList members={overrides.data.members} />;
}

/** Who may do what in the admin API: role grants and per-person overrides. Root only. */
export function AccessView() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <p className="text-overline text-brand-light uppercase">System</p>
        <h1 className="mt-1 text-hero text-text-primary">Access</h1>
        <p className="mt-1 max-w-2xl text-body text-text-muted">
          Give each role a level on every area of MCDI, and override it for one person when needed.
          Changes apply on the next request.
        </p>
      </header>

      <Tabs defaultValue="roles" className="flex flex-col gap-4">
        <TabsList aria-label="Access sections">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="overrides">Members with overrides</TabsTrigger>
        </TabsList>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
        <TabsContent value="overrides">
          <OverridesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
