'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

export interface ServerSelectorOption {
  id: string;
  name: string;
}

interface ServerSelectorProps {
  servers: ServerSelectorOption[];
  selected: string | null;
  onChange: (serverId: string) => void;
  disabled?: boolean;
}

/** Picks which server's sync history the log table below is scoped to. */
export function ServerSelector({ servers, selected, onChange, disabled }: ServerSelectorProps) {
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
