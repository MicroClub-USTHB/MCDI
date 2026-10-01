import { SearchInput } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

export type ServerTypeFilter = 'all' | 'main' | 'competition' | 'event' | 'other';
export type ServerStatusFilter = 'all' | 'active' | 'inactive';

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
      <SearchInput
        placeholder="Search by server name…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        containerClassName="w-full sm:max-w-xs"
        aria-label="Search servers"
      />
      <Select value={type} onValueChange={(value) => onTypeChange(value as ServerTypeFilter)}>
        <SelectTrigger className="w-full sm:w-40" aria-label="Filter by type">
          <SelectValue placeholder="All " />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All </SelectItem>
          <SelectItem value="main">Main</SelectItem>
          <SelectItem value="competition">Competition</SelectItem>
          <SelectItem value="event">Event</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(value) => onStatusChange(value as ServerStatusFilter)}>
        <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
          <SelectValue placeholder="All " />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All </SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export { ServerFilters, type ServerFiltersProps };
