'use client';

import { Hash, Lock, Megaphone, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import type { ChannelGroup, ChannelNode } from '@/features/channels/api/mappers';

const TYPE_ICON: Record<ChannelNode['type'], LucideIcon> = {
  text: Hash,
  announcement: Megaphone,
  voice: Volume2,
  category: Hash,
};

interface ChannelTreeProps {
  groups: ChannelGroup[];
  selectedId: string | null;
  onSelect: (channelId: string) => void;
}

/** Category-grouped channel list (issue AC: "Channels grouped by category in tree view"). */
export function ChannelTree({ groups, selectedId, onSelect }: ChannelTreeProps) {
  return (
    <nav className="flex flex-col gap-4 rounded-lg bg-surface-raised p-3" aria-label="Channels">
      {groups.map((group) => (
        <div key={group.id ?? '__uncategorized'} className="flex flex-col gap-1">
          <p className="px-2 text-overline text-text-faint uppercase">{group.name}</p>
          {group.channels.map((channel) => {
            const Icon = TYPE_ICON[channel.type];
            const active = channel.id === selectedId;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onSelect(channel.id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-body transition-colors',
                  active
                    ? 'bg-surface-active text-text-primary'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text-normal'
                )}
              >
                <Icon className="size-4 shrink-0 text-text-faint" aria-hidden="true" />
                <span className="truncate">{channel.name}</span>
                {channel.hasOverwrites && (
                  <Lock
                    className="ml-auto size-3 shrink-0 text-text-faint"
                    aria-label="Restricted"
                  />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
