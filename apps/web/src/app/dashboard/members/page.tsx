'use client';

import { useMemo, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Users } from 'lucide-react';

import { MemberFilters, MemberTable, ExportButton } from '@/features/members/components';
import { useMembersQuery } from '@/features/members/api/queries';
import type { MemberFilters as MemberFiltersState, MemberListItem } from '@/features/members/types';
import type { DataTableColumn } from '@/features/members/components/data-table';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Badge } from '@/shared/components/ui/badge';
import { LoadingSkeleton } from '@/shared/components/common';
import { MemberAvatar } from '@/features/members/components/MemberAvatar';

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

function parsePage(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null): number {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseFilters(searchParams: ReturnType<typeof useSearchParams>): MemberFiltersState {
  const filter = searchParams.get('filter') === 'club' ? 'club' : 'all';

  return {
    filter,
    serverIds: searchParams.getAll('serverId').filter(Boolean),
    roleIds: searchParams.getAll('roleId').filter(Boolean),
    search: searchParams.get('search') || undefined,
    page: parsePage(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('limit')),
  };
}

function writeFiltersToUrl(filters: MemberFiltersState, pathname: string): string {
  const params = new URLSearchParams();

  if (filters.filter === 'club') params.set('filter', 'club');
  filters.serverIds.forEach((serverId) => params.append('serverId', serverId));
  filters.roleIds.forEach((roleId) => params.append('roleId', roleId));
  if (filters.search) params.set('search', filters.search);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) params.set('limit', String(filters.pageSize));

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function mergeRoleNames(member: MemberListItem): string[] {
  return Array.from(new Set(member.servers.flatMap((server) => server.roleNames)));
}

export default function MembersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const query = useMembersQuery(filters);

  const columns = useMemo<DataTableColumn<MemberListItem>[]>(
    () => [
      {
        id: 'member',
        header: 'Member',
        cell: (member) => (
          <div className="flex items-center gap-3">
            <MemberAvatar
              displayName={member.displayName}
              avatarUrl={member.avatarUrl}
              avatarInitials={member.avatarInitials}
            />
            <div className="min-w-0">
              <div className="truncate text-subhead text-text-primary">{member.displayName}</div>
              <div className="truncate text-overline text-text-faint">@{member.username}</div>
              <div className="truncate text-overline text-text-faint">ID: {member.memberId}</div>
            </div>
          </div>
        ),
        className: 'w-[40%]',
      },
      {
        id: 'club',
        header: 'Club',
        cell: (member) =>
          member.isClubMember ? (
            <Badge variant="brand-light">Club member</Badge>
          ) : (
            <span className="text-text-faint">-</span>
          ),
        className: 'w-[12%]',
      },
      {
        id: 'servers',
        header: 'Servers',
        cell: (member) => (
          <span className="text-body text-text-normal">
            {member.serverCount} server{member.serverCount === 1 ? '' : 's'}
          </span>
        ),
        className: 'w-[12%]',
      },
      {
        id: 'roles',
        header: 'Roles',
        cell: (member) => {
          const roles = mergeRoleNames(member);
          const visibleRoles = roles.slice(0, 3);
          const extraCount = roles.length - visibleRoles.length;

          return roles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {visibleRoles.map((role) => (
                <Badge key={role} variant="secondary">
                  {role}
                </Badge>
              ))}
              {extraCount > 0 ? <Badge variant="outline">+{extraCount} more</Badge> : null}
            </div>
          ) : (
            <span className="text-text-faint">No roles</span>
          );
        },
        className: 'w-[36%]',
      },
    ],
    []
  );

  const updateFilters = useCallback(
    (next: Partial<MemberFiltersState>) => {
      const nextFilters = { ...filters, ...next };
      router.replace(writeFiltersToUrl(nextFilters, pathname));
    },
    [filters, pathname, router]
  );

  const clearFilters = useCallback(() => {
    router.replace(pathname);
  }, [pathname, router]);

  const page = query.data ?? {
    data: [],
    total: 0,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: 1,
  };

  const hasActiveFilters =
    filters.filter === 'club' ||
    filters.serverIds.length > 0 ||
    filters.roleIds.length > 0 ||
    Boolean(filters.search) ||
    filters.page !== 1 ||
    filters.pageSize !== DEFAULT_PAGE_SIZE;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-hero">Members</h1>
            <p className="mt-1 max-w-2xl text-body text-text-muted">
              Search club members, narrow by server or role, and export the filtered dataset.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton format="csv" filters={filters} />
            <ExportButton format="json" filters={filters} />
          </div>
        </div>
      </header>

      <MemberFilters
        filters={filters}
        onFilterChange={updateFilters}
        onClearFilters={clearFilters}
      />

      {query.isPending ? (
        <div className="space-y-4 rounded-lg border border-border bg-surface-raised p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingSkeleton key={index} className="h-12 rounded-lg" />
            ))}
          </div>
          <LoadingSkeleton className="h-16 rounded-lg" />
          <LoadingSkeleton className="h-16 rounded-lg" />
          <LoadingSkeleton className="h-16 rounded-lg" />
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn’t load members"
          description="The member list could not be retrieved right now. Try again in a moment."
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
      ) : (
        <MemberTable
          members={page.data}
          columns={columns}
          pagination={page}
          onRowClick={(member) => router.push(`/dashboard/members/${member.memberId}`)}
          onPageChange={(nextPage) => updateFilters({ page: nextPage })}
          onPageSizeChange={(nextPageSize) => updateFilters({ pageSize: nextPageSize, page: 1 })}
          isLoading={query.isPending}
          emptyState={
            <EmptyState
              icon={Users}
              title="No members found"
              description={
                hasActiveFilters
                  ? 'No members match the current search and filter combination.'
                  : 'There are no members to display yet.'
              }
              actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
              onAction={hasActiveFilters ? clearFilters : undefined}
            />
          }
        />
      )}
    </div>
  );
}
