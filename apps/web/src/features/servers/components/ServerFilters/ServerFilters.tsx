import { Search } from 'lucide-react';

import { McInput } from '@/shared/components/ui/mc-input';
import {
  McSelect,
  McSelectContent,
  McSelectItem,
  McSelectTrigger,
  McSelectValue,
} from '@/shared/components/ui/mc-select';

export type ServerTypeFilter = 'all' | 'main' | 'competition' | 'event' | 'other';
export type ServerStatusFilter = 'all' | 'active' | 'inactive';

const TYPE_ITEMS: { value: ServerTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'main', label: 'Main' },
  { value: 'competition', label: 'Competition' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
];

const STATUS_ITEMS: { value: ServerStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

interface ServerFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  type: ServerTypeFilter;
  onTypeChange: (value: ServerTypeFilter) => void;
  status: ServerStatusFilter;
  onStatusChange: (value: ServerStatusFilter) => void;
}

function ServerFilters({
  search,
  onSearchChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
}: ServerFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <McInput
        type="search"
        placeholder="Search by server name…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="w-full sm:max-w-xs"
        addonStart={<Search aria-hidden="true" />}
        aria-label="Search servers"
      />
      <McSelect
        items={TYPE_ITEMS}
        value={type}
        onValueChange={(value) => {
          if (value) onTypeChange(value);
        }}
      >
        <McSelectTrigger size="sm" className="w-full sm:w-40" aria-label="Filter by type">
          <McSelectValue placeholder="All" />
        </McSelectTrigger>
        <McSelectContent className="h-auto max-h-80 w-(--anchor-width)">
          {TYPE_ITEMS.map((item) => (
            <McSelectItem key={item.value} value={item.value}>
              {item.label}
            </McSelectItem>
          ))}
        </McSelectContent>
      </McSelect>
      <McSelect
        items={STATUS_ITEMS}
        value={status}
        onValueChange={(value) => {
          if (value) onStatusChange(value);
        }}
      >
        <McSelectTrigger size="sm" className="w-full sm:w-40" aria-label="Filter by status">
          <McSelectValue placeholder="All" />
        </McSelectTrigger>
        <McSelectContent className="h-auto max-h-80 w-(--anchor-width)">
          {STATUS_ITEMS.map((item) => (
            <McSelectItem key={item.value} value={item.value}>
              {item.label}
            </McSelectItem>
          ))}
        </McSelectContent>
      </McSelect>
    </div>
  );
}

export { ServerFilters, type ServerFiltersProps };
