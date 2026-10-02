'use client';

import { Badge } from '@/shared/components/ui/badge';
import type { ChannelDetailView } from '@/features/channels/api/mappers';

interface ChannelDetailProps {
  channel: ChannelDetailView;
}

/** Name / topic / type / NSFW / permission overwrites for the selected channel. */
export function ChannelDetail({ channel }: ChannelDetailProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-heading text-text-primary">#{channel.name}</h2>
        <Badge variant="secondary">{channel.typeLabel}</Badge>
        {channel.nsfw && <Badge variant="warning">NSFW</Badge>}
        {channel.overwriteCount > 0 && (
          <Badge variant="secondary">
            {channel.overwriteCount} permission overwrite{channel.overwriteCount === 1 ? '' : 's'}
          </Badge>
        )}
      </div>
      {channel.topic ? (
        <p className="text-body text-text-muted">{channel.topic}</p>
      ) : (
        <p className="text-body text-text-faint">No topic set.</p>
      )}
      <p className="font-mono text-overline text-text-subtle">ID: {channel.id}</p>
    </div>
  );
}
