'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Sparkles, X } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import { Button } from '@/shared/components/ui/button';
import { SearchInput } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import { useServersQuery } from '@/features/servers/api/queries';
import { useCan } from '@/shared/lib/use-access';
import { memberKeys } from '@/features/members/api/keys';
import { fetchServerRoles } from '@/features/members/api/service';
import type { MemberFilters, ServerRolesResponseDto } from '@/features/members/types';

interface MemberFiltersProps {
  filters: MemberFilters;
  onFilterChange: (next: Partial<MemberFilters>) => void;
  onClearFilters: () => void;
  /** A server's own roster: its server is fixed by the URL, so the server picker is hidden. */
  lockServer?: boolean;
}

interface PickerOption {
  id: string;
  label: string;
  searchText?: string;
}

interface PickerGroup {
  id: string;
  label: string;
  options: PickerOption[];
}

interface MultiSelectPickerProps {
  label: string;
  selectionType: 'server' | 'role';
  selectedIds: string[];
  options?: PickerOption[];
  groups?: PickerGroup[];
  searchPlaceholder: string;
  emptyMessage: string;
  loading?: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
}

function SearchFilterField({
  search,
  onFilterChange,
}: {
  search: string | undefined;
  onFilterChange: (next: Partial<MemberFilters>) => void;
}) {
  const [searchDraft, setSearchDraft] = useState(search ?? '');

  useEffect(() => {
    const normalizedSearch = searchDraft.trim() || undefined;
    if (normalizedSearch === (search ?? undefined)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onFilterChange({ search: normalizedSearch, page: 1 });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [onFilterChange, search, searchDraft]);

  return (
    <SearchInput
      id="member-search"
      value={searchDraft}
      onChange={(event) => setSearchDraft(event.target.value)}
      placeholder="Search username or global name"
      className="rounded-sm bg-background"
    />
  );
}

function toggleSelection(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function SelectedFilterChips({
  type,
  options,
  onRemove,
}: {
  type: 'server' | 'role';
  options: PickerOption[];
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className="flex h-7 max-w-full flex-nowrap gap-2 overflow-x-auto"
      aria-label={options.length > 0 ? `Selected ${type}s` : undefined}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onRemove(option.id)}
          aria-label={`Remove ${type} ${option.label}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 paragraph-xs font-semibold tracking-wide text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span>{option.label}</span>
          <X className="size-3 text-muted-foreground" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function MultiSelectPicker({
  label,
  selectionType,
  selectedIds,
  options,
  groups,
  searchPlaceholder,
  emptyMessage,
  loading = false,
  disabled = false,
  onToggle,
}: MultiSelectPickerProps) {
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    const sourceGroups = groups ?? [
      {
        id: label.toLowerCase(),
        label,
        options: options ?? [],
      },
    ];

    return sourceGroups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => {
          if (!normalizedSearch) return true;
          return (option.searchText ?? option.label).toLowerCase().includes(normalizedSearch);
        }),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, label, normalizedSearch, options]);

  const selectedOptions = useMemo(() => {
    const allOptions = (groups ?? [{ id: label, label, options: options ?? [] }]).flatMap(
      (group) => group.options
    );
    const optionsById = new Map(allOptions.map((option) => [option.id, option]));

    return selectedIds.map(
      (id) => optionsById.get(id) ?? { id, label: `Unknown ${selectionType} (${id})` }
    );
  }, [groups, label, options, selectedIds, selectionType]);

  return (
    <div className="space-y-1">
      <DropdownMenu.Root
        onOpenChange={(open) => {
          if (!open) setSearch('');
        }}
      >
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'inline-flex h-9 w-full items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 paragraph-sm text-foreground transition-colors',
              'hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              'disabled:pointer-events-none disabled:opacity-60'
            )}
          >
            <span>
              {selectedIds.length > 0 ? `${label} (${selectedIds.length} selected)` : label}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={8}
            className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-2 text-foreground shadow-xl outline-none"
          >
            <div className="border-b border-border pb-2">
              <label className="sr-only" htmlFor={`${label.toLowerCase()}-filter-search`}>
                Filter {label.toLowerCase()}
              </label>
              <input
                id={`${label.toLowerCase()}-filter-search`}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') event.stopPropagation();
                }}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-md border border-border bg-background px-3 paragraph-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              />
            </div>

            <div className="max-h-72 overflow-y-auto pt-2">
              {loading ? (
                <p className="px-2 py-4 paragraph-sm text-muted-foreground">
                  Loading {label.toLowerCase()}...
                </p>
              ) : filteredGroups.length === 0 ? (
                <p className="px-2 py-4 paragraph-sm text-muted-foreground">{emptyMessage}</p>
              ) : (
                filteredGroups.map((group) => (
                  <div key={group.id} className="space-y-1">
                    {groups ? (
                      <DropdownMenu.Label className="px-2 py-1 paragraph-xs font-semibold tracking-wide text-muted-foreground/70">
                        {group.label}
                      </DropdownMenu.Label>
                    ) : null}
                    {group.options.map((option) => (
                      <DropdownMenu.CheckboxItem
                        key={option.id}
                        checked={selectedIds.includes(option.id)}
                        onCheckedChange={() => onToggle(option.id)}
                        onSelect={(event) => event.preventDefault()}
                        className="relative flex cursor-pointer select-none items-center rounded-md py-2 pr-2 pl-9 paragraph-sm text-foreground outline-none data-[highlighted]:bg-muted"
                      >
                        <DropdownMenu.ItemIndicator className="absolute left-2 inline-flex items-center">
                          <Check className="size-4 text-primary" aria-hidden="true" />
                        </DropdownMenu.ItemIndicator>
                        <span>{option.label}</span>
                      </DropdownMenu.CheckboxItem>
                    ))}
                  </div>
                ))
              )}
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <SelectedFilterChips type={selectionType} options={selectedOptions} onRemove={onToggle} />
    </div>
  );
}

function getRoleLabel(roleId: string, roleName: string): string {
  const normalizedName = roleName.trim();
  return normalizedName || `Unnamed role (${roleId})`;
}

function memberRoleQueries(serverIds: string[]) {
  return serverIds.map((serverId) => ({
    queryKey: memberKeys.roles(serverId),
    queryFn: async () => {
      const response = await fetchServerRoles(serverId);
      return response.data;
    },
    enabled: Boolean(serverId),
    retry: false,
  }));
}

export function MemberFilters({
  filters,
  onFilterChange,
  onClearFilters,
  lockServer = false,
}: MemberFiltersProps) {
  const { data: servers = [], isPending: serversPending } = useServersQuery();
  const canServers = useCan('servers', 'read');
  const canRoleStats = useCan('stats', 'read');
  const roleQueries = useQueries({
    queries: memberRoleQueries(canRoleStats ? filters.serverIds : []),
  });

  const roleGroups = useMemo<ServerRolesResponseDto[]>(() => {
    return roleQueries
      .map((query) => query.data)
      .filter((group): group is ServerRolesResponseDto => Boolean(group));
  }, [roleQueries]);

  const serverOptions = useMemo<PickerOption[]>(
    () =>
      servers.map((server) => ({
        id: server.id,
        label: server.name.trim() || `Server ${server.id}`,
      })),
    [servers]
  );

  const rolePickerGroups = useMemo<PickerGroup[]>(
    () =>
      roleGroups.map((group) => ({
        id: group.serverId,
        label: group.serverName.trim() || `Server ${group.serverId}`,
        options: group.roles.map((role) => ({
          id: role.roleId,
          label: getRoleLabel(role.roleId, role.roleName),
          searchText: `${getRoleLabel(role.roleId, role.roleName)} ${role.roleId}`,
        })),
      })),
    [roleGroups]
  );

  const availableRoleIds = useMemo(
    () => new Set(roleGroups.flatMap((group) => group.roles.map((role) => role.roleId))),
    [roleGroups]
  );
  const roleQueriesSettled = roleQueries.every((query) => !query.isPending);

  useEffect(() => {
    if (!roleQueriesSettled) return;
    if (filters.roleIds.length === 0) return;

    const filteredRoleIds = filters.roleIds.filter((roleId) => availableRoleIds.has(roleId));
    if (filteredRoleIds.length === filters.roleIds.length) return;

    onFilterChange({ roleIds: filteredRoleIds, page: 1 });
  }, [availableRoleIds, filters.roleIds, onFilterChange, roleQueriesSettled]);

  const selectedServerIds = filters.serverIds;
  const roleLoading = roleQueries.some((query) => query.isPending);
  const hasActiveFilters =
    filters.filter === 'club' ||
    selectedServerIds.length > 0 ||
    filters.roleIds.length > 0 ||
    Boolean(filters.search) ||
    filters.page !== 1;

  return (
    <section className="rounded-lg border border-border bg-card p-3" aria-label="Member filters">
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_minmax(13rem,0.8fr)_minmax(13rem,0.8fr)_auto_auto]">
        <div className="min-w-0 space-y-1">
          <label
            className="paragraph-xs font-semibold tracking-wide text-muted-foreground"
            htmlFor="member-search"
          >
            Search
          </label>
          <SearchFilterField
            key={filters.search ?? ''}
            search={filters.search}
            onFilterChange={onFilterChange}
          />
        </div>

        {!lockServer && canServers && (
          <div className="min-w-0 space-y-1">
            <span className="paragraph-xs font-semibold tracking-wide text-muted-foreground">
              Servers
            </span>
            <MultiSelectPicker
              label="Servers"
              selectionType="server"
              options={serverOptions}
              selectedIds={selectedServerIds}
              searchPlaceholder="Search servers..."
              emptyMessage="No servers available."
              loading={serversPending}
              onToggle={(serverId) =>
                onFilterChange({
                  serverIds: toggleSelection(selectedServerIds, serverId),
                  page: 1,
                })
              }
            />
          </div>
        )}

        {canServers && canRoleStats ? (
          <div className="min-w-0 space-y-1">
            <span className="paragraph-xs font-semibold tracking-wide text-muted-foreground">
              Roles
            </span>
            <MultiSelectPicker
              label="Roles"
              selectionType="role"
              groups={rolePickerGroups}
              selectedIds={filters.roleIds}
              searchPlaceholder="Search roles..."
              emptyMessage={
                selectedServerIds.length === 0
                  ? 'Select at least one server to load roles.'
                  : 'No matching roles found.'
              }
              loading={selectedServerIds.length > 0 && roleLoading}
              disabled={selectedServerIds.length === 0}
              onToggle={(roleId) =>
                onFilterChange({
                  roleIds: toggleSelection(filters.roleIds, roleId),
                  page: 1,
                })
              }
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-2 xl:pt-5">
          <span className="paragraph-xs font-semibold tracking-wide text-muted-foreground">
            Club
          </span>
          <div
            className="inline-flex rounded-md border border-border bg-background p-0.5"
            role="group"
            aria-label="Club member filter"
          >
            <button
              type="button"
              aria-pressed={filters.filter === 'all'}
              onClick={() => onFilterChange({ filter: 'all', page: 1 })}
              className={cn(
                'rounded-sm px-2.5 py-1.5 paragraph-sm transition-colors',
                filters.filter === 'all'
                  ? 'bg-secondary text-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={filters.filter === 'club'}
              onClick={() => onFilterChange({ filter: 'club', page: 1 })}
              className={cn(
                'rounded-sm px-2.5 py-1.5 paragraph-sm transition-colors',
                filters.filter === 'club'
                  ? 'bg-secondary text-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              Club members
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={onClearFilters}>
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden="true" />
        <span className="paragraph-xs font-semibold tracking-wide">
          {hasActiveFilters
            ? 'Filters are active.'
            : 'Use the selectors to narrow the member list.'}
        </span>
      </div>
    </section>
  );
}
