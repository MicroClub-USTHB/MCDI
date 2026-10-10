'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

import { useOverridesListQuery } from '@/features/access/api/queries';
import { MemberChip } from '@/features/access/components/MemberChip';
import { useMembersQuery } from '@/features/members/api/queries';
import { LoadingSkeleton } from '@/shared/components/common';
import { Badge } from '@/shared/components/ui/badge';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { SearchInput } from '@/shared/components/ui/input';
import { Pagination } from '@/shared/components/ui/pagination';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { cn } from '@/shared/lib/utils';

const PAGE_SIZE = 25;

interface MemberPickerProps {
  selectedId: string | null;
  onSelect: (memberId: string) => void;
}

/**
 * The left pane of the Members tab: every member of the server, searchable and paginated,
 * with a mark on those who already carry an override.
 */
export function MemberPicker({ selectedId, onSelect }: MemberPickerProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  // A settled search starts back at the first page (adjust-during-render, no effect).
  const [settledSearch, setSettledSearch] = useState(debouncedSearch);
  if (settledSearch !== debouncedSearch) {
    setSettledSearch(debouncedSearch);
    setPage(1);
  }

  const query = useMembersQuery({
    filter: 'all',
    serverIds: [],
    roleIds: [],
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const overrides = useOverridesListQuery();
  const overrideIds = new Set((overrides.data?.members ?? []).map((member) => member.memberId));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SearchInput
        type="search"
        aria-label="Search members"
        placeholder="Search members…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {query.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn’t load members"
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
      ) : !query.data ? (
        <LoadingSkeleton className="h-48 rounded-lg" />
      ) : query.data.data.length === 0 ? (
        <p className="text-body text-text-muted">No members found.</p>
      ) : (
        <ul
          aria-label="Members"
          className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised"
        >
          {query.data.data.map((member) => (
            <li key={member.memberId} className="border-b border-border last:border-b-0">
              <button
                type="button"
                aria-current={selectedId === member.memberId ? 'true' : undefined}
                onClick={() => onSelect(member.memberId)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors',
                  selectedId === member.memberId
                    ? 'bg-surface-active'
                    : 'hover:bg-surface-hover hover:text-text-normal'
                )}
              >
                <MemberChip
                  displayName={member.displayName}
                  username={member.username}
                  avatar={member.avatarUrl}
                />
                {overrideIds.has(member.memberId) ? (
                  <Badge variant="outline" className="shrink-0">
                    Override
                  </Badge>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        pageIndex={page - 1}
        pageCount={query.data?.totalPages ?? 1}
        onPageChange={(index) => setPage(index + 1)}
        pageSize={PAGE_SIZE}
        totalItems={query.data?.total ?? 0}
      />
    </div>
  );
}
