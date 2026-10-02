'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

export interface ServerOption {
  id: string;
  name: string;
}

interface ServerContextSelectorProps {
  servers: ServerOption[];
  selected: string | null;
  onChange: (serverId: string) => void;
  disabled?: boolean;
}

/** Picks which server's channels the tree and composer operate on. */
export function ServerContextSelector({
  servers,
  selected,
  onChange,
  disabled,
}: ServerContextSelectorProps) {
  return (
    <Select
      value={selected ?? undefined}
      onValueChange={onChange}
      disabled={disabled || servers.length === 0}
    >
      <SelectTrigger aria-label="Select a server" className="w-64">
        <SelectValue placeholder="Select a server" />
      </SelectTrigger>
      <SelectContent>
        {servers.map((server) => (
          <SelectItem key={server.id} value={server.id}>
            {server.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
