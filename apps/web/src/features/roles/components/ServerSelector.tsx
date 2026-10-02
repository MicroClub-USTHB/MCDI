'use client';

import { useServersQuery } from '@/features/servers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Server } from 'lucide-react';

interface ServerSelectorProps {
  selected: string;
  onChange: (serverId: string) => void;
}

function ServerSelector({ selected, onChange }: ServerSelectorProps) {
  const { data: servers = [], isLoading } = useServersQuery();

  return (
    <Select value={selected} onValueChange={onChange}>
      <SelectTrigger aria-label="Select server" className="w-64 bg-surface-base">
        <SelectValue placeholder={isLoading ? 'Loading servers...' : 'Select a server'} />
      </SelectTrigger>
      <SelectContent>
        {servers.map((server) => (
          <SelectItem key={server.id} value={server.id}>
            <span className="flex items-center gap-2">
              {server.icon ? (
                <img
                  src={server.icon}
                  alt=""
                  className="size-4 rounded-full object-cover"
                  aria-hidden="true"
                />
              ) : (
                <Server className="size-4 text-text-subtle" aria-hidden="true" />
              )}
              <span className="truncate">{server.name}</span>
              {server.isMain && <span className="text-xs text-brand-light">Main</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { ServerSelector };
export type { ServerSelectorProps };
